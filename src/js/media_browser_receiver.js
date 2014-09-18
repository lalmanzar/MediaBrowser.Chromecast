function guid() {
    function _p8(s) {
        var p = (Math.random().toString(16) + "000000000").substr(2, 8);
        return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
    }
    return _p8(false) + _p8(true) + _p8(true) + _p8(false);
}

function parseISO8601Date(s, options) {

    options = options || {};

    // parenthese matches:
    // year month day    hours minutes seconds
    // dotmilliseconds
    // tzstring plusminus hours minutes
    var re = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|([+-])(\d{2}):(\d{2}))?/;

    var d = s.match(re);

    // "2010-12-07T11:00:00.000-09:00" parses to:
    //  ["2010-12-07T11:00:00.000-09:00", "2010", "12", "07", "11",
    //     "00", "00", ".000", "-09:00", "-", "09", "00"]
    // "2010-12-07T11:00:00.000Z" parses to:
    //  ["2010-12-07T11:00:00.000Z",      "2010", "12", "07", "11",
    //     "00", "00", ".000", "Z", undefined, undefined, undefined]

    if (!d) {

        throw "Couldn't parse ISO 8601 date string '" + s + "'";
    }

    // parse strings, leading zeros into proper ints
    var a = [1, 2, 3, 4, 5, 6, 10, 11];
    for (var i in a) {
        d[a[i]] = parseInt(d[a[i]], 10);
    }
    d[7] = parseFloat(d[7]);

    // Date.UTC(year, month[, date[, hrs[, min[, sec[, ms]]]]])
    // note that month is 0-11, not 1-12
    // see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Date/UTC
    var ms = Date.UTC(d[1], d[2] - 1, d[3], d[4], d[5], d[6]);

    // if there are milliseconds, add them
    if (d[7] > 0) {
        ms += Math.round(d[7] * 1000);
    }

    // if there's a timezone, calculate it
    if (d[8] != "Z" && d[10]) {
        var offset = d[10] * 60 * 60 * 1000;
        if (d[11]) {
            offset += d[11] * 60 * 1000;
        }
        if (d[9] == "-") {
            ms -= offset;
        } else {
            ms += offset;
        }
    } else if (!options.toLocal) {
        ms += new Date().getTimezoneOffset() * 60000;
    }

    return new Date(ms);
}

function getCodecLimits() {

    return {

        maxVideoAudioChannels: 6,
        maxAudioChannels: 2,
        maxVideoLevel: 50,
        maxWidth: 1920,
        maxHeight: 1080,
        maxSampleRate: 48000

    };
}

function setMetadata(item, metadata) {

    if (item.Type == 'Episode') {

        //metadata.type = chrome.cast.media.MetadataType.TV_SHOW;

        metadata.episodeTitle = item.Name;

        if (item.PremiereDate) {
            metadata.originalAirdate = parseISO8601Date(item.PremiereDate).toISOString();
        }

        metadata.seriesTitle = item.SeriesName;

        if (item.IndexNumber != null) {
            metadata.episode = metadata.episodeNumber = item.IndexNumber;
        }

        if (item.ParentIndexNumber != null) {
            metadata.season = metadata.seasonNumber = item.ParentIndexNumber;
        }
    }

    else if (item.Type == 'Photo') {

        //metadata.type = chrome.cast.media.MetadataType.PHOTO;

        if (item.PremiereDate) {
            metadata.creationDateTime = parseISO8601Date(item.PremiereDate).toISOString();
        }
    }

    else if (item.MediaType == 'Audio') {

        //metadata.type = chrome.cast.media.MetadataType.MUSIC_TRACK;

        if (item.ProductionYear) {
            metadata.releaseYear = item.ProductionYear;
        }

        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(item.PremiereDate).toISOString();
        }

        metadata.songName = item.Name;
        metadata.artist = item.Artists & item.Artists.length ? item.Artists[0] : '';
        metadata.albumArtist = item.AlbumArtist;

        if (item.IndexNumber != null) {
            metadata.trackNumber = item.IndexNumber;
        }

        if (item.ParentIndexNumber != null) {
            metadata.discNumber = item.ParentIndexNumber;
        }

        var composer = (item.People || []).filter(function (p) {
            return p.PersonType == 'Type';
        })[0];

        if (composer) {
            metadata.composer = composer.Name;
        }
    }

    else if (item.MediaType == 'Movie') {

        //metadata.type = chrome.cast.media.MetadataType.MOVIE;

        if (item.ProductionYear) {
            metadata.releaseYear = item.ProductionYear;
        }

        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(item.PremiereDate).toISOString();
        }
    }

    else {

        //metadata.type = chrome.cast.media.MetadataType.GENERIC;

        if (item.ProductionYear) {
            metadata.releaseYear = item.ProductionYear;
        }

        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(item.PremiereDate).toISOString();
        }
    }

    metadata.title = item.Name;

    if (item.Studios && item.Studios.length) {
        metadata.Studio = item.Studios[0];
    }

    return metadata;
}

function canDirectStream(mediaType, mediaSource, maxBitrate) {

    // If bitrate is unknown don't direct stream
    if (!mediaSource.Bitrate || mediaSource.Bitrate > maxBitrate) {
        return false;
    }

    var codecLimits = getCodecLimits();

    if (mediaType == "Audio") {

        return ['mp3', 'aac'].indexOf(mediaSource.Container || '') != -1;
    }
    else if (mediaType == "Video") {

        var videoStream = mediaSource.MediaStreams.filter(function (s) {

            return s.Type == 'Video';

        })[0];

        if (!videoStream) {
            return false;
        }

        if (['high', 'main', 'baseline', 'constrained baseline'].indexOf((videoStream.Profile || '').toLowerCase()) == -1) {
            return false;
        }

        if (!videoStream.Level || videoStream.Level > codecLimits.maxVideoLevel) {
            return false;
        }

        if (!videoStream.Width || videoStream.Width > codecLimits.maxWidth) {
            return false;
        }

        if (!videoStream.Height || videoStream.Height > codecLimits.maxHeight) {
            return false;
        }

        if (videoStream.IsAnamorphic) {
            return false;
        }

        if (videoStream.BitDepth && videoStream.BitDepth > 8) {
            return false;
        }

        if (videoStream.RefFrames && videoStream.RefFrames > 4) {
            return false;
        }

        return ['mp4', 'm4v', 'mkv'].indexOf(mediaSource.Container || '') != -1;
    }

    throw new Error('Unrecognized MediaType');
}

function canPlayAudioStreamDirect(audioStream, isVideo) {

    var audioCodec = (audioStream.Codec || '').toLowerCase().replace('-', '');

    if (audioCodec.indexOf('aac') == -1 &&
        audioCodec.indexOf('mp3') == -1 &&
        audioCodec.indexOf('mpeg') == -1) {

        return false;
    }

    var codecLimits = getCodecLimits();

    var maxChannels = isVideo ? codecLimits.maxVideoAudioChannels : codecLimits.maxAudioChannels;

    if (!audioStream.Channels || audioStream.Channels > maxChannels) {
        return false;
    }

    if (!audioStream.SampleRate || audioStream.SampleRate > codecLimits.maxSampleRate) {
        return false;
    }

    var bitrate = audioStream.BitRate;
    if (!bitrate) {
        return false;
    }

    if (isVideo) {

        if (audioCodec.indexOf('aac') != -1 && bitrate > 768000) {
            return false;
        }
        if (audioCodec.indexOf('mp3') != -1 || audioCodec.indexOf('mpeg') != -1) {
            if (bitrate > 320000) {
                return false;
            }
        }

    } else {
        if (bitrate > 320000) {
            return false;
        }
    }

    return true;
}

function isSupportedCodec(mediaType, mediaSource) {

    if (mediaType == "Audio") {
        return false;
    }
    else if (mediaType == "Video") {

        return mediaSource.MediaStreams.filter(function (m) {

            return m.Type == "Video" && (m.Codec || '').toLowerCase() == 'h264';

        }).length > 0;
    }

    throw new Error('Unrecognized MediaType');
}

function getStreamByIndex(streams, type, index) {
    return streams.filter(function (s) {

        return s.Type == type && s.Index == index;

    })[0];
}

function getMediaSourceInfo(item, maxBitrate, mediaSourceId, audioStreamIndex, subtitleStreamIndex) {

    var sources = item.MediaSources.filter(function (m) {

        m.audioStream = mediaSourceId == m.Id && audioStreamIndex != null ?
            getStreamByIndex(m.MediaStreams, 'Audio', audioStreamIndex) :
            getStreamByIndex(m.MediaStreams, 'Audio', m.DefaultAudioStreamIndex);

        if (item.MediaType == "Audio" && !m.audioStream) {
            m.audioStream = m.MediaStreams.filter(function (s) {
                return s.Type == 'Audio';
            })[0];
        }

        m.subtitleStream = mediaSourceId == m.Id && subtitleStreamIndex != null ?
            getStreamByIndex(m.MediaStreams, 'Subtitle', subtitleStreamIndex) :
            getStreamByIndex(m.MediaStreams, 'Subtitle', m.DefaultSubtitleStreamIndex);

        return !mediaSourceId || m.Id == mediaSourceId;

    });

    // Find first one that can be direct streamed
    var source = sources.filter(function (m) {

        var audioStream = m.audioStream;

        if (!audioStream || !canPlayAudioStreamDirect(audioStream, item.MediaType == 'Video')) {
            return false;
        }

        if (m.subtitleStream && !m.subtitleStream.IsTextSubtitleStream) {
            return false;
        }

        return canDirectStream(item.MediaType, m, maxBitrate, audioStream);

    })[0];

    if (source) {
        return {
            mediaSource: source,
            isStatic: true,
            streamContainer: source.Container,
            canSeek: true,
            canClientSeek: true
        };
    }

    // Find first one with supported codec
    source = sources.filter(function (m) {

        return isSupportedCodec(item.MediaType, m);

    })[0];

    source = source || sources[0];

    var container = item.MediaType == 'Audio' ? 'mp3' : 'm3u8';

    var canSeek = (source.RunTimeTicks || 0) > 0;

    // TODO: Remove this check by supporting changing the mediaElement src dynamically.
    // It is a pain and will require unbinding all event handlers during the operation
    if (container != 'm3u8') {
        canSeek = false;
    }

    // Default to first one
    return {
        mediaSource: source,
        isStatic: false,
        streamContainer: container,
        canSeek: canSeek,
        canClientSeek: canSeek && container == 'm3u8'
    };
}

function getStreamInfo(serverAddress, deviceId, item, startPositionTicks, maxBitrate, mediaSourceId, audioStreamIndex, subtitleStreamIndex) {

    var mediaSourceInfo = getMediaSourceInfo(item, maxBitrate, mediaSourceId, audioStreamIndex, subtitleStreamIndex);

    var url = getStreamUrl(serverAddress, deviceId, item.MediaType, item.Id, mediaSourceInfo, startPositionTicks, maxBitrate);

    mediaSourceInfo.url = url;

    var subtitleStream = mediaSourceInfo.mediaSource.subtitleStream;
    if (subtitleStream && subtitleStream.IsTextSubtitleStream) {
        mediaSourceInfo.subtitleStreamUrl = getSubtitleStreamUrl(serverAddress, item.Id, mediaSourceInfo, subtitleStream.Index);
        console.log('Subtitle url: ' + mediaSourceInfo.subtitleStreamUrl);
    } else {
        mediaSourceInfo.subtitleStreamUrl = null;
    }

    return mediaSourceInfo;
};

function getSubtitleStreamUrl(serverAddress, itemId, mediaSourceInfo, subtitleStreamIndex) {
    var url = null;
    if (subtitleStreamIndex !== null && subtitleStreamIndex !== undefined) {
        url = serverAddress + '/mediabrowser/Videos/' + itemId + '/' + mediaSourceInfo.mediaSource.Id + '/Subtitles/' + subtitleStreamIndex + '/Stream.js';
    }
    return url;
};

function getStreamUrl(serverAddress, deviceId, mediaType, itemId, mediaSourceInfo, startPositionTicks, maxBitrate) {

    var url;

    var codecLimits = getCodecLimits();

    if (mediaType == 'Audio') {

        url = serverAddress + '/mediabrowser/audio/' + itemId + '/stream.' + mediaSourceInfo.streamContainer;

        url += '?mediasourceid=' + mediaSourceInfo.mediaSource.Id;

        if (mediaSourceInfo.isStatic) {
            url += '&static=true';

        } else {

            url += '&maxaudiochannels=' + codecLimits.maxAudioChannels;

            if (startPositionTicks) {
                url += '&startTimeTicks=' + startPositionTicks.toString();
            }

            if (maxBitrate) {
                url += '&audiobitrate=' + Math.min(maxBitrate, 320000).toString();
            }

            url += '&deviceId=' + deviceId;
        }

        return url;

    }
    else if (mediaType == 'Video') {

        if (mediaSourceInfo.isStatic) {
            url = serverAddress + '/mediabrowser/videos/' + itemId + '/stream.' + mediaSourceInfo.streamContainer + '?static=true';
        }
        else {
            url = serverAddress + '/mediabrowser/videos/' + itemId + '/master.m3u8?EnableAdaptiveBitrateStreaming=false';
        }

        url += '&maxaudiochannels=' + codecLimits.maxVideoAudioChannels;

        if (maxBitrate) {

            var audioRate = 320000;
            url += '&audiobitrate=' + audioRate.toString();
            url += '&videobitrate=' + (maxBitrate - audioRate).toString();
        }

        url += '&profile=high';
        url += '&level=41';

        url += '&maxwidth=' + codecLimits.maxWidth;
        url += '&maxheight=' + codecLimits.maxHeight;

        url += '&videoCodec=h264';
        url += '&audioCodec=aac';

        url += '&mediasourceid=' + mediaSourceInfo.mediaSource.Id;
        url += '&deviceId=' + deviceId;

        return url;
    }

    throw new Error('Unrecognized MediaType');
}

function updateTimeOfDay($scope) {

    var now = new Date();

    var time = now.toLocaleTimeString().toLowerCase();

    var text = time.split(':');
    var suffix = '';

    if (text.length == 3) {

        // Fix for toLocaleTimeString returning wrong hour
        if (time.indexOf('pm') != -1 || time.indexOf('am') != -1) {
            text[0] = (now.getHours() % 12) || 12;
        }

        text = text[0] + ':' + text[1];

        if (time.indexOf('pm') != -1) {
            suffix = 'pm';
        }
        else if (time.indexOf('am') != -1) {
            suffix = 'am';
        }

        time = text;
    }

    $scope.timePrefix = time;
    $scope.timeSuffix = suffix;
}

function resetPlaybackScope($scope) {
    $scope.status = 'waiting';

    $scope.startPositionTicks = 0;
    $scope.runtimeTicks = 0;
    $scope.poster = '';
    $scope.backdrop = '';
    $scope.waitingbackdrop = '';
    $scope.mediaTitle = '';
    $scope.secondaryTitle = '';
    $scope.currentTime = 0;
    $scope.mediaType = '';
    $scope.itemId = '';
    $scope.artist = '';
    $scope.albumTitle = '';

    updateTimeOfDay($scope);

    $scope.audioStreamIndex = null;
    $scope.subtitleStreamIndex = null;
    $scope.mediaSourceId = '';

    $scope.showPoster = false;

    $scope.playMethod = '';
    $scope.canSeek = false;
    $scope.canClientSeek = false;

    $scope.item = null;

    // Detail content
    $scope.detailLogoUrl = '';
    $scope.detailImageUrl = '';
    $scope.overview = '';
    $scope.genres = '';
    $scope.displayName = '';
    document.getElementById('miscInfo').innerHTML = '';
    document.getElementById('playedIndicator').style.display = 'none';
    $scope.hasPlayedPercentage = false;
    $scope.playedPercentage = 0;
}

function getUrl(serverAddress, name) {

    if (!name) {
        throw new Error("Url name cannot be empty");
    }

    var url = serverAddress;

    url += "/mediabrowser/" + name;

    return url;
}

window.deviceInfo = {
    deviceId: guid(),
    deviceName: 'Chromecast',
    versionNumber: '2.0.000'
};

function getSecurityHeaders(accessToken, userId) {

    var auth = 'MediaBrowser Client="Chromecast", Device="' + deviceInfo.deviceName + '", DeviceId="' + deviceInfo.deviceId + '", Version="' + deviceInfo.versionNumber + '"';

    if (userId) {
        auth += ', UserId="' + userId + '"';
    }

    var headers = {
        Authorization: auth
    }

    headers["X-MediaBrowser-Token"] = accessToken;

    return headers;
}

function getBackdropUrl(item, serverAddress) {

    var url;

    if (item.BackdropImageTags && item.BackdropImageTags.length) {
        url = serverAddress + '/mediabrowser/Items/' + item.Id + '/Images/Backdrop/0?format=webp&tag=' + item.BackdropImageTags[0];
    } else if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) {
        url = serverAddress + '/mediabrowser/Items/' + item.ParentBackdropItemId + '/Images/Backdrop/0?format=webp&tag=' + item.ParentBackdropImageTags[0];
    }

    return url;
}

function getLogoUrl(item, serverAddress) {

    var url;

    if (item.ImageTags && item.ImageTags.Logo) {
        url = serverAddress + '/mediabrowser/Items/' + item.Id + '/Images/Logo/0?format=webp&tag=' + item.ImageTags.Logo;
    } else if (item.ParentLogoItemId && item.ParentLogoImageTag) {
        url = serverAddress + '/mediabrowser/Items/' + item.ParentLogoItemId + '/Images/Logo/0?format=webp&tag=' + item.ParentLogoImageTag;
    }

    return url;
}

function getPrimaryImageUrl(item, serverAddress) {

    var posterUrl = '';

    if (item.AlbumPrimaryImageTag) {
        posterUrl = serverAddress + '/mediabrowser/Items/' + item.AlbumId + '/Images/Primary?format=webp&tag=' + (item.AlbumPrimaryImageTag);
    }
    else if (item.PrimaryImageTag) {
        posterUrl = serverAddress + '/mediabrowser/Items/' + item.Id + '/Images/Primary?format=webp&tag=' + (item.PrimaryImageTag);
    }
    else if (item.ImageTags.Primary) {
        posterUrl = serverAddress + '/mediabrowser/Items/' + item.Id + '/Images/Primary?format=webp&tag=' + (item.ImageTags.Primary);
    }

    return posterUrl;
}

function getDisplayName(item) {
    var name = item.EpisodeTitle || item.Name;

    if (item.Type == "TvChannel") {

        if (item.Number) {
            return item.Number + ' ' + name;
        }
        return name;
    }

    if (item.Type == "Episode" && item.IndexNumber != null && item.ParentIndexNumber != null) {

        var displayIndexNumber = item.IndexNumber;

        var number = "E" + displayIndexNumber;

        number = "S" + item.ParentIndexNumber + ", " + number;

        if (item.IndexNumberEnd) {

            displayIndexNumber = item.IndexNumberEnd;
            number += "-" + displayIndexNumber;
        }

        name = number + " - " + name;
    }

    return name;
}

var module = angular.module('mediaBrowser', []);

module.config(function ($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
});

//Setup
module.run(function ($rootScope) {
    window.mediaElement = document.getElementById('video-player');
    window.mediaManager = new cast.receiver.MediaManager(window.mediaElement);
});

module.filter('displayTime', function () {
    return function (ticks) {
        var ticksPerHour = 36000000000;

        var parts = [];

        var hours = ticks / ticksPerHour;
        hours = Math.floor(hours);

        if (hours) {
            parts.push(hours);
        }

        ticks -= (hours * ticksPerHour);

        var ticksPerMinute = 600000000;

        var minutes = ticks / ticksPerMinute;
        minutes = Math.floor(minutes);

        ticks -= (minutes * ticksPerMinute);

        if (minutes < 10 && hours) {
            minutes = '0' + minutes;
        }
        parts.push(minutes);

        var ticksPerSecond = 10000000;

        var seconds = ticks / ticksPerSecond;
        seconds = Math.round(seconds);

        if (seconds < 10) {
            seconds = '0' + seconds;
        }
        parts.push(seconds);

        return parts.join(':');
    };
});

module.factory('mediaBrowserActions', function ($timeout, $interval, $http, $q) {

    var factory = {};
    var controlsPromise, delayStartPromise, closeAppPromise;

    var setControls = function ($scope) {
        $timeout.cancel(controlsPromise);
        controlsPromise = $timeout(function () {
            if ($scope.status == 'playing-with-controls') {
                $scope.status = 'playing';
            }
        }, 8000);
    };

    var setApplicationClose = function () {
        $timeout.cancel(closeAppPromise);
        closeAppPromise = $timeout(function () {
            window.close();
        }, 3600000, false);
    };

    var clearTimeouts = function () {
        $timeout.cancel(controlsPromise);
        $timeout.cancel(closeAppPromise);
        $timeout.cancel(delayStartPromise);
    };

    var fallBackBackdropImg = function ($scope, src) {
        if (!src) {
            $scope.$apply(function () {
                $scope.backdrop = "img/bg.jpg";
            });
            return;
        }

        var setBackdrop = function () {
            var imageSrc = this.src;
            $scope.$apply(function () {
                $scope.backdrop = imageSrc;
            });
        };

        var loadElement = document.createElement('img');
        loadElement.src = src;
        loadElement.addEventListener('error', function () {
            loadElement.removeEventListener('load', setBackdrop);
        });

        loadElement.addEventListener('load', setBackdrop);
        $timeout(function () {
            loadElement.removeEventListener('load', setBackdrop);
        }, 30000);
    };

    factory.reportPlaybackStart = function ($scope, options) {

        this.stopDynamicContent();

        var deferred = $q.defer();
        deferred.resolve();

        if (!$scope.userId) {
            console.log("null userId");
            return deferred.promise;
        }

        if (!$scope.serverAddress) {
            console.log("null serverAddress");
            return deferred.promise;
        }

        var url = getUrl($scope.serverAddress, "Sessions/Playing");

        broadcastToMessageBus({
            type: 'playbackstart',
            data: getSenderReportingData($scope, options)
        });

        return $http.post(url, options,
          {
              headers: getSecurityHeaders($scope.accessToken, $scope.userId)
          });
    };

    factory.reportPlaybackProgress = function ($scope, options, reportToServer) {

        var deferred = $q.defer();
        deferred.resolve();

        if (!$scope.userId) {
            console.log("null userId");
            return deferred.promise;
        }

        if (!$scope.serverAddress) {
            console.log("null serverAddress");
            return deferred.promise;
        }

        broadcastToMessageBus({
            type: 'playbackprogress',
            data: getSenderReportingData($scope, options)
        });

        if (reportToServer === false) {
            return deferred.promise;
        }

        var url = getUrl($scope.serverAddress, "Sessions/Playing/Progress");

        return $http.post(url, options,
          {
              headers: getSecurityHeaders($scope.accessToken, $scope.userId)
          });
    };

    factory.reportPlaybackStopped = function ($scope, options) {

        var deferred = $q.defer();
        deferred.resolve();

        if (!$scope.userId) {
            console.log("null userId");
            return deferred.promise;
        }

        if (!$scope.serverAddress) {
            console.log("null serverAddress");
            return deferred.promise;
        }

        var url = getUrl($scope.serverAddress, "Sessions/Playing/Stopped");

        broadcastToMessageBus({
            type: 'playbackstop',
            data: getSenderReportingData($scope, options)
        });

        return $http.post(url, options,
          {
              headers: getSecurityHeaders($scope.accessToken, $scope.userId)
          });
    };

    factory.stopTranscoding = function (serverAddress, accessToken, userId) {

        var deferred = $q.defer();
        deferred.resolve();

        if (!userId) {
            console.log("null userId");
            return deferred.promise;
        }

        if (!serverAddress) {
            console.log("null serverAddress");
            return deferred.promise;
        }

        var url = getUrl(serverAddress, "Videos/ActiveEncodings");

        return $http.delete(url,
          {
              params: {
                  deviceId: deviceInfo.deviceId
              },
              headers: getSecurityHeaders(accessToken, userId)
          });
    };

    var backdropInterval;
    function clearBackropInterval() {
        if (backdropInterval) {
            $interval.cancel(backdropInterval);
            backdropInterval = null;
        }
    }

    function startBackdropInterval($scope, serverAddress, accessToken, userId) {

        clearBackropInterval();

        setRandomUserBackdrop($scope, serverAddress, accessToken, userId);

        backdropInterval = $interval(function () {
            setRandomUserBackdrop($scope, serverAddress, accessToken, userId);
        }, 30000);
    }

    function setRandomUserBackdrop($scope, serverAddress, accessToken, userId) {

        console.log('setRandomUserBackdrop');

        var url = getUrl(serverAddress, "Users/" + userId + "/Items");

        $http.get(url, {
            headers: getSecurityHeaders(accessToken, userId),
            params: {
                SortBy: "Random",
                IncludeItemTypes: "Movie,Series",
                ImageTypes: 'Backdrop',
                Recursive: true,

                // Although we're limiting to what the user has access to,
                // not everyone will want to see adult backdrops rotating on their TV.
                MaxOfficialRating: 'R',

                Limit: 1
            }
        }).success(function (result) {
            var item = result.Items[0];

            var backdropUrl = '';

            if (item) {
                backdropUrl = getBackdropUrl(item, serverAddress) || '';
            }

            $timeout(function () {
                $scope.waitingbackdrop = backdropUrl;
            }, 0);

        });
    }

    factory.displayUserInfo = function ($scope, serverAddress, accessToken, userId) {

        startBackdropInterval($scope, serverAddress, accessToken, userId);
    };

    factory.stopDynamicContent = function () {
        clearBackropInterval();
    };

    function showItem($scope, serverAddress, accessToken, userId, item) {

        clearBackropInterval();

        console.log('showItem');

        var backdropUrl = getBackdropUrl(item, serverAddress) || '';
        var detailImageUrl = getPrimaryImageUrl(item, serverAddress) || '';

        $timeout(function () {
            $scope.status = 'details';
            $scope.waitingbackdrop = backdropUrl;

            $scope.detailLogoUrl = getLogoUrl(item, serverAddress) || '';
            $scope.overview = item.Overview || '';
            $scope.genres = item.Genres.join(' / ');
            $scope.displayName = getDisplayName(item);
            document.getElementById('miscInfo').innerHTML = getMiscInfoHtml(item) || '';
            document.getElementById('detailRating').innerHTML = getRatingHtml(item);

            var playedIndicator = document.getElementById('playedIndicator');

            if (item.UserData.Played) {

                playedIndicator.style.display = 'block';
                playedIndicator.innerHTML = '<span class="glyphicon glyphicon-ok"></span>';
            }
            else if (item.UserData.UnplayedItemCount) {

                playedIndicator.style.display = 'block';
                playedIndicator.innerHTML = item.UserData.UnplayedItemCount;
            }
            else {
                playedIndicator.style.display = 'none';
            }

            if (item.UserData.PlayedPercentage && item.UserData.PlayedPercentage < 100 && !item.IsFolder) {
                $scope.hasPlayedPercentage = false;
                $scope.playedPercentage = item.UserData.PlayedPercentage;

                detailImageUrl += "&PercentPlayed=" + parseInt(item.UserData.PlayedPercentage);

            } else {
                $scope.hasPlayedPercentage = false;
                $scope.playedPercentage = 0;
            }

            $scope.detailImageUrl = detailImageUrl;

        }, 0);
    }

    factory.displayItem = function ($scope, serverAddress, accessToken, userId, itemId) {

        console.log('Displaying item: ' + itemId);

        var url = getUrl(serverAddress, "Users/" + userId + "/Items/" + itemId);

        $http.get(url, {
            headers: getSecurityHeaders(accessToken, userId)
        }).success(function (item) {
            showItem($scope, serverAddress, accessToken, userId, item);
        });
    };

    factory.getSubtitle = function ($scope, subtitleStreamUrl) {
        return $http.get(subtitleStreamUrl, {
            headers: getSecurityHeaders($scope.accessToken, $scope.userId)
        });
    };

    factory.load = function ($scope, customData, serverItem) {

        resetPlaybackScope($scope);

        clearTimeouts();

        angular.extend($scope, customData);

        var data = serverItem;

        $scope.item = data;

        var isSeries = !!data.SeriesName;
        var backdropUrl = '';

        if (data.BackdropImageTags && data.BackdropImageTags.length) {
            backdropUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.Id + '/Images/Backdrop/0?format=webp&tag=' + data.BackdropImageTags[0];
        } else {
            if (data.ParentBackdropItemId && data.ParentBackdropImageTags && data.ParentBackdropImageTags.length) {
                backdropUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.ParentBackdropItemId + '/Images/Backdrop/0?format=webp&tag=' + data.ParentBackdropImageTags[0];
            }
        }

        var posterUrl = '';

        if (isSeries && data.SeriesPrimaryImageTag) {
            posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.SeriesId + '/Images/Primary?format=webp&tag=' + data.SeriesPrimaryImageTag;
        }
        else if (data.AlbumPrimaryImageTag) {
            posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.AlbumId + '/Images/Primary?format=webp&tag=' + (data.AlbumPrimaryImageTag);
        }
        else if (data.PrimaryImageTag) {
            posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.Id + '/Images/Primary?format=webp&tag=' + (data.PrimaryImageTag);
        }
        else if (data.ImageTags.Primary) {
            posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.Id + '/Images/Primary?format=webp&tag=' + (data.ImageTags.Primary);
        }

        $scope.poster = posterUrl;
        fallBackBackdropImg($scope, backdropUrl);
        $scope.mediaTitle = isSeries ? data.SeriesName : data.Name;
        $scope.secondaryTitle = isSeries ? data.Name : '';

        if (data.MediaType == "Audio" && data.Artists && data.Album) {
            $scope.artist = data.Artists[0];
            $scope.albumTitle = data.Album;
            $scope.showPoster = true;
        }

        $scope.status = 'backdrop';
        $scope.mediaType = data.MediaType;

        $scope.detailLogoUrl = getLogoUrl(data, $scope.serverAddress) || '';

        clearTimeouts();
    };

    factory.delayStart = function ($scope) {
        delayStartPromise = $timeout(function () {

            factory.reportPlaybackStart($scope, getReportingParams($scope)).finally(function () {
                window.mediaElement.play();
                $scope.status = 'playing-with-controls';
                if ($scope.mediaType == "Audio") {
                    $scope.status = "audio";
                }
                $scope.paused = false;
            });

        }, 1000).then(function () {
            setControls($scope);
        });
    };

    factory.play = function ($scope, event) {
        $scope.$apply(function () {
            $scope.paused = false;
        });

        if ($scope.status == 'backdrop' || $scope.status == 'playing-with-controls' || $scope.status == 'playing' || $scope.status == 'audio') {
            clearTimeouts();
            $timeout(function () {

                var startTime = new Date();
                window.mediaElement.play();
                window.mediaElement.pause();
                while (typeof (window.mediaElement.buffered) === 'undefined' || window.mediaElement.buffered.length === 0) {
                    if ((new Date()) - startTime > 25000) {
                        $scope.status = 'waiting';
                        factory.setApplicationClose();
                        return;
                    }
                }

                window.mediaManager.defaultOnPlay(event);

                $scope.status = 'playing-with-controls';
                if ($scope.mediaType == "Audio") {
                    $scope.status = "audio";
                }

            }, 20).then(function () {
                setControls($scope);
            });
        }
    };

    factory.pause = function ($scope) {
        $scope.$apply(function () {
            $scope.status = 'playing-with-controls';
            if ($scope.mediaType == "Audio") {
                $scope.status = "audio";
            }
            $scope.paused = true;
            $scope.currentTime = window.mediaElement.currentTime;
            clearTimeouts();
        });
    };

    factory.stop = function ($scope) {
        $scope.$apply(function () {
            clearTimeouts();
            $scope.status = 'waiting';
            setApplicationClose();
        });
    };

    factory.setApplicationClose = setApplicationClose;

    return factory;
});

window.playOptions = {
    maxBitrate: 3000000
};

window.playlist = [];
window.currentPlaylistIndex = -1;

function unloadPlayer() {
    if (window.player !== null && window.player !== undefined) {
        window.player.unload();    // Must unload before starting again.
        window.player = null;
    }
}

window.VolumeInfo = {
    IsMuted: false,
    Level: 100
};

function getReportingParams($scope) {

    var positionTicks = window.mediaElement.currentTime * 10000000;

    if (!$scope.canClientSeek) {

        positionTicks += ($scope.startPositionTicks || 0);
    }

    return {
        PositionTicks: positionTicks,
        IsPaused: window.mediaElement.paused,
        IsMuted: window.VolumeInfo.IsMuted,
        AudioStreamIndex: $scope.audioStreamIndex,
        SubtitleStreamIndex: $scope.subtitleStreamIndex,
        VolumeLevel: window.VolumeInfo.Level,
        ItemId: $scope.itemId,
        MediaSourceId: $scope.mediaSourceId,
        QueueableMediaTypes: ['Audio', 'Video'],
        CanSeek: $scope.canSeek,
        PlayMethod: $scope.playMethod
    };
}

function getSenderReportingData($scope, reportingData) {

    var state = {
        ItemId: reportingData.ItemId,
        PlayState: angular.extend({}, reportingData),
        QueueableMediaTypes: reportingData.QueueableMediaTypes
    };

    // Don't want this here
    state.PlayState.QueueableMediaTypes = null;
    delete state.PlayState.QueueableMediaTypes;
    state.PlayState.ItemId = null;
    delete state.PlayState.ItemId;

    state.NowPlayingItem = {

        Id: reportingData.ItemId,
        RunTimeTicks: $scope.runtimeTicks
    };

    var item = $scope.item;

    if (item) {

        var nowPlayingItem = state.NowPlayingItem;

        nowPlayingItem.Chapters = item.Chapters || [];

        // TODO: Fill these
        var mediaSource = item.MediaSources.filter(function (m) {
            return m.Id == reportingData.MediaSourceId;
        })[0];

        nowPlayingItem.MediaStreams = mediaSource ? mediaSource.MediaStreams : [];

        nowPlayingItem.MediaType = item.MediaType;
        nowPlayingItem.Type = item.Type;
        nowPlayingItem.Name = item.Name;

        nowPlayingItem.IndexNumber = item.IndexNumber;
        nowPlayingItem.IndexNumberEnd = item.IndexNumberEnd;
        nowPlayingItem.ParentIndexNumber = item.ParentIndexNumber;
        nowPlayingItem.ProductionYear = item.ProductionYear;
        nowPlayingItem.PremiereDate = item.PremiereDate;
        nowPlayingItem.SeriesName = item.SeriesName;
        nowPlayingItem.Album = item.Album;
        nowPlayingItem.Artists = item.Artists;

        var imageTags = item.ImageTags || {};

        if (item.SeriesPrimaryImageTag) {

            nowPlayingItem.PrimaryImageItemId = item.SeriesId;
            nowPlayingItem.PrimaryImageTag = item.SeriesPrimaryImageTag;
        }
        else if (imageTags.Primary) {

            nowPlayingItem.PrimaryImageItemId = item.Id;
            nowPlayingItem.PrimaryImageTag = imageTags.Primary;
        }
        else if (item.AlbumPrimaryImageTag) {

            nowPlayingItem.PrimaryImageItemId = item.AlbumId;
            nowPlayingItem.PrimaryImageTag = item.AlbumPrimaryImageTag;
        }
        else if (item.SeriesPrimaryImageTag) {

            nowPlayingItem.PrimaryImageItemId = item.SeriesId;
            nowPlayingItem.PrimaryImageTag = item.SeriesPrimaryImageTag;
        }

        if (item.BackdropImageTags && item.BackdropImageTags.length) {

            nowPlayingItem.BackdropItemId = item.Id;
            nowPlayingItem.BackdropImageTag = item.BackdropImageTags[0];
        }

        if (imageTags.Thumb) {

            nowPlayingItem.ThumbItemId = item.Id;
            nowPlayingItem.ThumbImageTag = imageTags.Thumb;
        }

        if (imageTags.Logo) {

            nowPlayingItem.LogoItemId = item.Id;
            nowPlayingItem.LogoImageTag = imageTags.Logo;
        }
        else if (item.ParentLogoImageTag) {

            nowPlayingItem.LogoItemId = item.ParentLogoItemId;
            nowPlayingItem.LogoImageTag = item.ParentLogoImageTag;
        }
    }

    return state;
}

function clearMediaElement() {
    document.getElementById('video-player').src = "";
}

function broadcastToMessageBus(msg) {

    window.playlistMessageBus.broadcast(msg);
}

//Controllers
module.controller('MainCtrl', function ($scope, $interval, $timeout, $q, $http, mediaBrowserActions) {

    $interval(function () {
        updateTimeOfDay($scope);
    }, 30000);

    // According to cast docs this should be disabled when not needed
    //cast.receiver.logger.setLevelValue(cast.receiver.LoggerLevel.ERROR);

    var init = function () {

        resetPlaybackScope($scope);
        clearMediaElement();
    };

    init();

    mediaBrowserActions.setApplicationClose();

    var mgr = window.mediaManager;

    var broadcastToServer = new Date();

    function onMediaElementTimeUpdate() {
        var now = new Date();

        var elapsed = now - broadcastToServer;

        if (elapsed > 5000) {

            mediaBrowserActions.reportPlaybackProgress($scope, getReportingParams($scope));
            broadcastToServer = now;
        }
        else if (elapsed > 1500) {

            mediaBrowserActions.reportPlaybackProgress($scope, getReportingParams($scope), false);
        }

        if (elapsed > 1000) {

            $scope.$apply(function () {
                $scope.currentTime = window.mediaElement.currentTime;
            });
        }
    }

    function enableTimeUpdateListener(enabled) {
        if (enabled) {
            window.mediaElement.addEventListener('timeupdate', onMediaElementTimeUpdate);
        } else {
            window.mediaElement.removeEventListener('timeupdate', onMediaElementTimeUpdate);
        }
    }

    function isPlaying() {
        return window.playlist.length > 0;
    }

    window.addEventListener('beforeunload', function () {

        // Try to cleanup after ourselves before the page closes
        enableTimeUpdateListener(false);
        mediaBrowserActions.stopTranscoding($scope.serverAddress, $scope.accessToken, $scope.userId);
        mediaBrowserActions.reportPlaybackStopped($scope, getReportingParams($scope));
    });

    mgr.defaultOnPlay = mgr.onPlay;
    mgr.onPlay = function (event) {
        mediaBrowserActions.play($scope, event);
        mediaBrowserActions.reportPlaybackProgress($scope, getReportingParams($scope));
    };

    mgr.defaultOnPause = mgr.onPause;
    mgr.onPause = function (event) {
        mgr.defaultOnPause(event);
        mediaBrowserActions.pause($scope);
        mediaBrowserActions.reportPlaybackProgress($scope, getReportingParams($scope));
    };

    mgr.defaultOnStop = mgr.onStop;
    mgr.onStop = function (event) {
        stop();
    };

    mgr.onEnded = function () {
        mediaBrowserActions.setApplicationClose();
        enableTimeUpdateListener(false);
        mediaBrowserActions.reportPlaybackStopped($scope, getReportingParams($scope));
        mediaBrowserActions.stopTranscoding($scope.serverAddress, $scope.accessToken, $scope.userId);
        $scope.$apply(init);

        if (!playNextItem()) {
            window.playlist = [];
            window.currentPlaylistIndex = -1;
            mediaBrowserActions.displayUserInfo($scope, $scope.serverAddress, $scope.accessToken, $scope.userId);
        }
    };

    function stop(nextMode) {
        mgr.defaultOnStop(event);
        mediaBrowserActions.stop($scope);
        enableTimeUpdateListener(false);
        mediaBrowserActions.reportPlaybackStopped($scope, getReportingParams($scope));

        clearMediaElement();

        mediaBrowserActions.stopTranscoding($scope.serverAddress, $scope.accessToken, $scope.userId).success(function () {

            if (nextMode == "next") {
                playNextItem();
            }
            else if (nextMode == "previous") {
                playPreviousItem();
            } else {

                window.playlist = [];
                window.currentPlaylistIndex = -1;

                mediaBrowserActions.displayUserInfo($scope, $scope.serverAddress, $scope.accessToken, $scope.userId);
            }
        });
    }

    window.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();

    window.castReceiverManager.onSystemVolumeChanged = function (event) {
        console.log("### Cast Receiver Manager - System Volume Changed : " + JSON.stringify(event));

        // See cast.receiver.media.Volume
        console.log("### Volume: " + event.data['level'] + " is muted? " + event.data['muted']);

        window.VolumeInfo.Level = (event.data['level'] || 1) * 100;
        window.VolumeInfo.IsMuted = event.data['muted'] || false;
    }

    console.log('Application is ready, starting system');

    // Create a custom namespace channel to receive commands from the sender
    // app to add items to a playlist
    window.playlistMessageBus = window.castReceiverManager.getCastMessageBus('urn:x-cast:com.google.cast.mediabrowser.v3', cast.receiver.CastMessageBus.MessageType.JSON);

    function processMessage(data) {

        if (!data.command || !data.serverAddress || !data.userId || !data.accessToken) {

            console.log('Invalid message sent from sender. Sending error response');

            broadcastToMessageBus({
                type: 'error',
                message: "Missing one or more required params - command,options,userId,accessToken,serverAddress"
            });
            return;
        }

        data.options = data.options || {};
        window.deviceInfo.deviceName = data.receiverName || window.deviceInfo.deviceName;
        window.playOptions.maxBitrate = Math.min(data.maxBitrate || window.playOptions.maxBitrate, 10000000);

        // Items will have properties - Id, Name, Type, MediaType, IsFolder

        if (data.command == 'PlayLast' || data.command == 'PlayNext') {

            tagItems(data.options.items, data);
            queue(data.options.items, data.command);
        }
        else if (data.command == 'Shuffle') {
            shuffle(data, data.options, data.options.items[0]);
        }
        else if (data.command == 'InstantMix') {
            instantMix(data, data.options, data.options.items[0]);
        }
        else if (data.command == 'DisplayContent') {

            if (!isPlaying()) {

                console.log('DisplayContent');

                mediaBrowserActions.displayItem($scope, data.serverAddress, data.accessToken, data.userId, data.options.ItemId);
            }

        }
        else if (data.command == 'NextTrack') {

            if (window.playlist && window.currentPlaylistIndex < window.playlist.length - 1) {
                stop("next");
            }

        }
        else if (data.command == 'PreviousTrack') {

            if (window.playlist && window.currentPlaylistIndex > 0) {
                stop("previous");
            }

        }
        else if (data.command == 'SetAudioStreamIndex') {

            // TODO

        }
        else if (data.command == 'SetSubtitleStreamIndex') {

            // TODO

        }
        else if (data.command == 'VolumeUp') {

            // TODO

        }
        else if (data.command == 'VolumeDown') {

            // TODO

        }
        else if (data.command == 'ToggleMute') {

            // TODO

        }
        else if (data.command == 'Identify') {

            if (!isPlaying()) {
                mediaBrowserActions.displayUserInfo($scope, data.serverAddress, data.accessToken, data.userId);
            }
        }
        else {

            translateItems(data, data.options, data.options.items);
        }
    }

    // Create a message handler for the custome namespace channel
    window.playlistMessageBus.onMessage = function (event) {

        console.log('Playlist message: ' + JSON.stringify(event));

        var data = event.data;

        data.options = data.options || {};
        data.options.senderId = event.senderId;

        processMessage(data);
    };

    function tagItems(items, data) {

        // Attach server data to the items
        // Once day the items could be coming from multiple servers, each with their own security info
        for (var i = 0, length = items.length; i < length; i++) {

            items[i].userId = data.userId;
            items[i].accessToken = data.accessToken;
            items[i].serverAddress = data.serverAddress;
        }
    }

    function translateItems(data, options, items) {

        var callback = function (result) {

            options.items = result.Items;
            tagItems(options.items, data);
            playFromOptions(data.options);
        };

        var promise = translateRequestedItems($q, $http, data.serverAddress, data.accessToken, data.userId, items);

        if (promise.success) {
            promise.success(callback);
        } else {
            promise.then(callback);
        }
    }

    function instantMix(data, options, item) {

        getInstantMixItems($http, data.serverAddress, data.accessToken, data.userId, item).success(function (result) {

            options.items = result.Items;
            tagItems(options.items, data);
            playFromOptions(data.options);
        });
    }

    function shuffle(data, options, item) {

        getShuffleItems($http, data.serverAddress, data.accessToken, data.userId, item).success(function (result) {

            options.items = result.Items;
            tagItems(options.items, data);
            playFromOptions(data.options);
        });
    }

    function queue(items, method) {
        window.playlist.push(items);
    }

    function playFromOptions(options) {

        var firstItem = options.items[0];

        if (options.startPositionTicks || firstItem.MediaType !== 'Video') {
            playFromOptionsInternal(options);
            return;
        }

        getIntros($http, firstItem.serverAddress, firstItem.accessToken, firstItem.userId, firstItem).success(function (intros) {

            options.items = intros.Items.concat(options.items);
            playFromOptionsInternal(options);
        });
    }

    function playFromOptionsInternal(options) {

        window.playlist = options.items;
        window.currentPlaylistIndex = -1;
        playNextItem(options);
    }

    // Plays the next item in the list
    function playNextItem(options) {

        var playlist = window.playlist;

        if (playlist && window.currentPlaylistIndex < playlist.length - 1) {
            window.currentPlaylistIndex++;

            var item = playlist[window.currentPlaylistIndex];

            playItem(item, options || {});
            return true;
        }
        return false;
    }

    function playPreviousItem(options) {

        var playlist = window.playlist;

        if (playlist && window.currentPlaylistIndex > 0) {
            window.currentPlaylistIndex--;

            var item = playlist[window.currentPlaylistIndex];

            playItem(item, options || {});
            return true;
        }
        return false;
    }

    function playItem(item, options) {

        var requestUrl = getUrl(item.serverAddress, 'Users/' + item.userId + '/Items/' + item.Id);

        return $http.get(requestUrl).success(function (data) {

            // Attach the custom properties we created like userId, serverAddress, itemId, etc
            angular.extend(data, item);

            playItemInternal(data, options);
        });
    }

    function playItemInternal(item, options) {

        //mediaBrowserActions.stopTranscoding($scope);

        $timeout(function () {
            $scope.status = 'loading';
        }, 0);

        unloadPlayer();

        var streamInfo = getStreamInfo(item.serverAddress,
            deviceInfo.deviceId,
            item,
            options.startPositionTicks,
            window.playOptions.maxBitrate,
            options.mediaSourceId,
            options.audioStreamIndex,
            options.subtitleStreamIndex);

        var url = streamInfo.url;
        while (window.mediaElement.firstChild) {
            window.mediaElement.removeChild(window.mediaElement.firstChild);
        }
        var track;
        if(window.mediaElement.textTracks.length == 0) {
            window.mediaElement.addTextTrack("subtitles");
        }
        track = window.mediaElement.textTracks[0];
        var cues = track.cues;
        for (var i = cues.length - 1 ; i>=0 ; i--) {
            track.removeCue(cues[i]);
        }
        if (streamInfo.subtitleStreamUrl) {
            mediaBrowserActions.getSubtitle($scope, streamInfo.subtitleStreamUrl).success(function (data) {
                
                track.mode = "showing";

                data.TrackEvents.forEach(function (trackEvent) {
                    track.addCue(new TextTrackCue(trackEvent.StartPositionTicks / 10000000, trackEvent.EndPositionTicks / 10000000, trackEvent.Text.replace(/\\N/gi,'\n')));
                });
            });
        }

        var mediaInfo = {
            customData: {
                startPositionTicks: options.startPositionTicks || 0,
                serverAddress: item.serverAddress,
                userId: item.userId,
                itemId: item.Id,
                mediaSourceId: streamInfo.mediaSource.Id,
                audioStreamIndex: streamInfo.mediaSource.audioStream ? streamInfo.mediaSource.audioStream.Index : null,
                subtitleStreamIndex: streamInfo.mediaSource.subtitleStream ? streamInfo.mediaSource.subtitleStream.Index : null,
                playMethod: streamInfo.isStatic ? 'DirectStream' : 'Transcode',
                runtimeTicks: streamInfo.mediaSource.RunTimeTicks,
                accessToken: item.accessToken,
                canSeek: streamInfo.canSeek,
                canClientSeek: streamInfo.canClientSeek
            },
            metadata: {},
            contentId: url,
            contentType: streamInfo.contentType,
            tracks: undefined,
            streamType: cast.receiver.media.StreamType.BUFFERED
        };

        if (streamInfo.mediaSource.RunTimeTicks) {
            mediaInfo.duration = Math.floor(streamInfo.mediaSource.RunTimeTicks / 10000000);
        }

        mediaBrowserActions.load($scope, mediaInfo.customData, item);

        var autoplay = true;

        mediaElement.autoplay = autoplay;

        // Create the Host - much of your interaction with the library uses the Host and
        // methods you provide to it.
        var host = new cast.player.api.Host({ 'mediaElement': window.mediaElement, 'url': url });

        // TODO: Add info from startPositionTicks
        var startSeconds = options.startPositionTicks && streamInfo.canClientSeek ? (Math.floor(options.startPositionTicks / 10000000)) : 0;

        console.log('Video start position seconds: ' + startSeconds);

        var protocol = null;

        if (url.lastIndexOf('.m3u8') >= 0) {
            // HTTP Live Streaming
            protocol = cast.player.api.CreateHlsStreamingProtocol(host);
        } else if (url.lastIndexOf('.mpd') >= 0) {
            // MPEG-DASH
            protocol = cast.player.api.CreateDashStreamingProtocol(host);
        } else if (url.indexOf('.ism/') >= 0) {
            // Smooth Streaming
            protocol = cast.player.api.CreateSmoothStreamingProtocol(host);
        }

        host.onError = function (errorCode) {
            console.log("Fatal Error - " + errorCode);

            mediaBrowserActions.stopTranscoding($scope.serverAddress, $scope.accessToken, $scope.userId);

            broadcastToMessageBus({
                type: 'error',
                message: "Fatal Error - " + errorCode
            });
            unloadPlayer();
        };

        if (protocol !== null) {

            console.log("Starting Media Player Library");
            window.player = new cast.player.api.Player(host);
            window.player.load(protocol, startSeconds);

            if (autoplay) {
                window.mediaElement.pause();
                mediaBrowserActions.delayStart($scope);
            }

        } else {

            var seekParam = startSeconds ? '#t=' + (startSeconds) : '';
            window.mediaElement.src = url + seekParam;
            window.mediaElement.autoplay = true;

            window.mediaElement.load();
            if (autoplay) {
                window.mediaElement.pause();
                mediaBrowserActions.delayStart($scope);
            }
        }

        enableTimeUpdateListener(false);
        enableTimeUpdateListener(true);

        setMetadata(item, mediaInfo.metadata);

        // We use false as we do not want to broadcast the new status yet
        // we will broadcast manually when the media has been loaded, this
        // is to be sure the duration has been updated in the media element
        window.mediaManager.setMediaInformation(mediaInfo, false);
    }

    window.castReceiverManager.start();
});

var requiredItemFields = "MediaSources,Chapters";

function getShuffleItems($http, serverAddress, accessToken, userId, item) {

    var query = {
        UserId: userId,
        Fields: requiredItemFields,
        Limit: 50,
        Filters: "IsNotFolder",
        Recursive: true,
        SortBy: "Random"
    };

    if (item.Type == "MusicArtist") {

        query.MediaTypes = "Audio";
        query.Artists = item.Name;

    }
    else if (item.Type == "MusicGenre") {

        query.MediaTypes = "Audio";
        query.Genres = item.Name;

    }
    else {
        query.ParentId = item.Id;
    }

    return getItemsForPlayback($http, serverAddress, accessToken, userId, query);
}

function getInstantMixItems($http, serverAddress, accessToken, userId, item) {

    var query = {
        UserId: userId,
        Fields: requiredItemFields,
        Limit: 50
    };

    var url;

    if (item.Type == "MusicArtist") {

        url = "Artists/InstantMix";
        query.Id = item.Id;

    }
    else if (item.Type == "MusicGenre") {

        url = "MusicGenres/InstantMix";
        query.Id = item.Id;

    }
    else if (item.Type == "MusicAlbum") {

        url = "Albums/" + item.Id + "/InstantMix";

    }
    else if (item.Type == "Audio") {

        url = "Songs/" + item.Id + "/InstantMix";
    }
    else if (item.Type == "Playlist") {

        url = "Playlists/" + item.Id + "/InstantMix";
    }

    url = getUrl(serverAddress, url);

    return $http.get(url, {
        headers: getSecurityHeaders(accessToken, userId),
        params: query
    });
}

function getItemsForPlayback($http, serverAddress, accessToken, userId, query) {

    query.UserId = userId;
    query.Limit = query.Limit || 100;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = "Virtual";

    var url = getUrl(serverAddress, "Users/" + userId + "/Items");

    return $http.get(url, {
        headers: getSecurityHeaders(accessToken, userId),
        params: query
    });
}

function getIntros($http, serverAddress, accessToken, userId, firstItem) {

    var url = getUrl(serverAddress, 'Users/' + userId + '/Items/' + firstItem.Id + '/Intros');

    return $http.get(url, {
        headers: getSecurityHeaders(accessToken, userId)
    });
}

function translateRequestedItems($q, $http, serverAddress, accessToken, userId, items) {

    var firstItem = items[0];

    if (firstItem.Type == "Playlist") {

        return getItemsForPlayback($http, serverAddress, accessToken, userId, {
            ParentId: firstItem.Id
        });

    } else if (firstItem.Type == "MusicArtist") {

        return getItemsForPlayback($http, serverAddress, accessToken, userId, {
            Artists: firstItem.Name,
            Filters: "IsNotFolder",
            Recursive: true,
            SortBy: "SortName",
            MediaTypes: "Audio"
        });

    } else if (firstItem.Type == "MusicGenre") {

        return getItemsForPlayback($http, serverAddress, accessToken, userId, {
            Genres: firstItem.Name,
            Filters: "IsNotFolder",
            Recursive: true,
            SortBy: "SortName",
            MediaTypes: "Audio"
        });

    } else if (firstItem.IsFolder) {

        return getItemsForPlayback($http, serverAddress, accessToken, userId, {
            ParentId: firstItem.Id,
            Filters: "IsNotFolder",
            Recursive: true,
            SortBy: "SortName",
            MediaTypes: "Audio,Video"
        });
    }

    var deferred = $q.defer();
    deferred.resolve({ Items: items });
    return deferred.promise;
}

function getMiscInfoHtml(item) {

    var miscInfo = [];
    var text, date;

    if (item.Type == "Episode") {

        if (item.PremiereDate) {

            try {
                date = parseISO8601Date(item.PremiereDate, { toLocal: true });

                text = date.toLocaleDateString();
                miscInfo.push(text);
            }
            catch (e) {
                console.log("Error parsing date: " + item.PremiereDate);
            }
        }
    }

    if (item.StartDate) {

        try {
            date = parseISO8601Date(item.StartDate, { toLocal: true });

            text = date.toLocaleDateString();
            miscInfo.push(text);

            if (item.Type != "Recording") {
                //text = LiveTvHelpers.getDisplayTime(date);
                //miscInfo.push(text);
            }
        }
        catch (e) {
            console.log("Error parsing date: " + item.PremiereDate);
        }
    }

    if (item.ProductionYear && item.Type == "Series") {

        if (item.Status == "Continuing") {
            miscInfo.push(item.ProductionYear + "-Present");

        }
        else if (item.ProductionYear) {

            text = item.ProductionYear;

            if (item.EndDate) {

                try {

                    var endYear = parseISO8601Date(item.EndDate, { toLocal: true }).getFullYear();

                    if (endYear != item.ProductionYear) {
                        text += "-" + parseISO8601Date(item.EndDate, { toLocal: true }).getFullYear();
                    }

                }
                catch (e) {
                    console.log("Error parsing date: " + item.EndDate);
                }
            }

            miscInfo.push(text);
        }
    }

    if (item.Type != "Series" && item.Type != "Episode") {

        if (item.ProductionYear) {

            miscInfo.push(item.ProductionYear);
        }
        else if (item.PremiereDate) {

            try {
                text = parseISO8601Date(item.PremiereDate, { toLocal: true }).getFullYear();
                miscInfo.push(text);
            }
            catch (e) {
                console.log("Error parsing date: " + item.PremiereDate);
            }
        }
    }

    var minutes;

    if (item.RunTimeTicks && item.Type != "Series") {

        if (item.Type == "Audio") {

            miscInfo.push(getDisplayRunTime(item.RunTimeTicks));

        } else {
            minutes = item.RunTimeTicks / 600000000;

            minutes = minutes || 1;

            miscInfo.push(Math.round(minutes) + "min");
        }
    }

    if (item.OfficialRating && item.Type !== "Season" && item.Type !== "Episode") {
        miscInfo.push(item.OfficialRating);
    }

    if (item.Video3DFormat) {
        miscInfo.push("3D");
    }

    return miscInfo.join('&nbsp;&nbsp;&nbsp;&nbsp;');
}

function getDisplayRunTime(ticks) {

    var ticksPerHour = 36000000000;
    var ticksPerMinute = 600000000;
    var ticksPerSecond = 10000000;

    var parts = [];

    var hours = ticks / ticksPerHour;
    hours = Math.floor(hours);

    if (hours) {
        parts.push(hours);
    }

    ticks -= (hours * ticksPerHour);

    var minutes = ticks / ticksPerMinute;
    minutes = Math.floor(minutes);

    ticks -= (minutes * ticksPerMinute);

    if (minutes < 10 && hours) {
        minutes = '0' + minutes;
    }
    parts.push(minutes);

    var seconds = ticks / ticksPerSecond;
    seconds = Math.floor(seconds);

    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    parts.push(seconds);

    return parts.join(':');
}

function getRatingHtml(item) {
    var html = "";

    if (item.CommunityRating) {

        html += "<div class='starRating' title='" + item.CommunityRating + "'></div>";
        html += '<div class="starRatingValue">';
        html += item.CommunityRating.toFixed(1);
        html += '</div>';
    }

    if (item.CriticRating != null) {

        if (item.CriticRating >= 60) {
            html += '<div class="fresh rottentomatoesicon" title="fresh"></div>';
        } else {
            html += '<div class="rotten rottentomatoesicon" title="rotten"></div>';
        }

        html += '<div class="criticRating">' + item.CriticRating + '%</div>';
    }

    //if (item.Metascore && metascore !== false) {

    //    if (item.Metascore >= 60) {
    //        html += '<div class="metascore metascorehigh" title="Metascore">' + item.Metascore + '</div>';
    //    }
    //    else if (item.Metascore >= 40) {
    //        html += '<div class="metascore metascoremid" title="Metascore">' + item.Metascore + '</div>';
    //    } else {
    //        html += '<div class="metascore metascorelow" title="Metascore">' + item.Metascore + '</div>';
    //    }
    //}

    return html;
}