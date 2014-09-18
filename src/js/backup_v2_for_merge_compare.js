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
        maxVideoLevel: 41,
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

        if (['high', 'main', 'baseline'].indexOf((videoStream.Profile || '').toLowerCase()) == -1) {
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

        return ['mp4'].indexOf(mediaSource.Container || '') != -1;
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

function getStreamInfo(serverAddress, deviceId, item, startTimeTicks, maxBitrate, mediaSourceId, audioStreamIndex, subtitleStreamIndex) {

    var mediaSourceInfo = getMediaSourceInfo(item, maxBitrate, mediaSourceId, audioStreamIndex, subtitleStreamIndex);

    var url = getStreamUrl(serverAddress, deviceId, item, mediaSourceInfo, startTimeTicks, maxBitrate);

    mediaSourceInfo.url = url;

    var subtitleStream = mediaSourceInfo.mediaSource.subtitleStream;
    if (subtitleStream) {
        mediaSourceInfo.subtitleStreamUrl = getSubtitleStreamUrl(serverAddress, item, mediaSourceInfo, subtitleStream.Index);
    } else {
        mediaSourceInfo.subtitleStreamUrl = null;
    }

    return mediaSourceInfo;
};

function getSubtitleStreamUrl(serverAddress, item, mediaSourceInfo, subtitleStreamIndex) {
    var url = null;
    if (subtitleStreamIndex !== null && subtitleStreamIndex !== undefined) {
        url = serverAddress + '/mediabrowser/Videos/' + item.Id + '/' + mediaSourceInfo.mediaSource.Id + '/Subtitles/' + subtitleStreamIndex + '/Stream.vtt';
    }
    return url;
};

function getStreamUrl(serverAddress, deviceId, item, mediaSourceInfo, startTimeTicks, maxBitrate) {

    var url;

    var codecLimits = getCodecLimits();

    if (item.MediaType == 'Audio') {

        url = serverAddress + '/mediabrowser/audio/' + item.Id + '/stream.' + mediaSourceInfo.streamContainer;

        url += '?mediasourceid=' + mediaSourceInfo.mediaSource.Id;

        if (mediaSourceInfo.isStatic) {
            url += '&static=true';

        } else {

            url += '&maxaudiochannels=' + codecLimits.maxAudioChannels;

            if (startTimeTicks) {
                url += '&startTimeTicks=' + startTimeTicks.toString();
            }

            if (maxBitrate) {
                url += '&audiobitrate=' + Math.min(maxBitrate, 320000).toString();
            }

            url += '&deviceId=' + deviceId;
        }

        return url;

    }
    else if (item.MediaType == 'Video') {

        if (mediaSourceInfo.isStatic) {
            url = serverAddress + '/mediabrowser/videos/' + item.Id + '/stream.' + mediaSourceInfo.streamContainer + '?static=true';
        }
        else {
            url = serverAddress + '/mediabrowser/videos/' + item.Id + '/master.m3u8?EnableAdaptiveBitrateStreaming=false';
        }

        url += '&maxaudiochannels=' + codecLimits.maxVideoAudioChannels;

        if (maxBitrate) {

            var audioRate = 128000;
            url += '&audiobitrate=' + audioRate.toString();
            url += '&videobitrate=' + (maxBitrate - audioRate).toString();
        }

        url += '&profile=high';
        url += '&level=' + codecLimits.maxVideoLevel;

        url += '&maxwidth=' + codecLimits.maxWidth;
        url += '&maxheight=' + codecLimits.maxHeight;

        url += '&videoCodec=h264';
        url += '&audioCodec=aac,mp3';

        url += '&mediasourceid=' + mediaSourceInfo.mediaSource.Id;
        url += '&deviceId=' + deviceId;

        return url;
    }

    throw new Error('Unrecognized MediaType');
}

function resetPlaybackScope($scope) {
    $scope.status = 'waiting';

    $scope.startTimeTicks = 0;
    $scope.runtimeTicks = 0;
    $scope.poster = '';
    $scope.backdrop = '';
    $scope.mediaTitle = '';
    $scope.secondaryTitle = '';
    $scope.currentTime = 0;
    $scope.mediaType = '';
    $scope.itemId = '';
    $scope.artist = '';
    $scope.albumTitle = '';

    $scope.audioStreamIndex = null;
    $scope.subtitleStreamIndex = null;
    $scope.mediaSourceId = '';

    $scope.showPoster = false;

    $scope.playMethod = '';
    $scope.canSeek = false;
    $scope.canClientSeek = false;

    $scope.item = null;
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
    $rootScope.versionNumber = '2.0.000';
    $rootScope.guid = guid();
    $rootScope.deviceName = 'Chromecast';
    $rootScope.deviceId = $rootScope.guid;
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

module.factory('mediaBrowserActions', function ($timeout, $http, $q) {

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
        }, 300000, false);
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

    var authorizationHeader = function ($scope) {
        var auth = 'MediaBrowser Client="Chromecast", Device="' + $scope.deviceName + '", DeviceId="' + $scope.deviceId + '", Version="' + $scope.versionNumber + '"';

        if ($scope.userId) {
            auth += ', UserId="' + $scope.userId + '"';
        }

        return auth;
    };

    var securityHeaders = function ($scope) {

        var headers = {
            Authorization: authorizationHeader($scope)
        }

        headers["X-MediaBrowser-Token"] = $scope.accessToken;

        return headers;
    };

    var getUrl = function ($scope, name) {

        if (!name) {
            throw new Error("Url name cannot be empty");
        }

        var url = $scope.serverAddress;

        url += "/mediabrowser/" + name;

        return url;
    };

    factory.reportPlaybackStart = function ($scope, options) {

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

        var url = getUrl($scope, "Sessions/Playing");

        broadcastToMessageBus({
            type: 'playbackstart',
            data: getSenderReportingData($scope, options)
        });

        return $http.post(url, options,
          {
              headers: securityHeaders($scope)
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

        var url = getUrl($scope, "Sessions/Playing/Progress");

        return $http.post(url, options,
          {
              headers: securityHeaders($scope)
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

        var url = getUrl($scope, "Sessions/Playing/Stopped");

        broadcastToMessageBus({
            type: 'playbackstop',
            data: getSenderReportingData($scope, options)
        });

        return $http.post(url, options,
          {
              headers: securityHeaders($scope)
          });
    };

    factory.stopTranscoding = function ($scope) {

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

        var url = getUrl($scope, "Videos/ActiveEncodings");

        return $http.delete(url,
          {
              params: {
                  deviceId: $scope.deviceId
              },
              headers: securityHeaders($scope)
          });
    };

    factory.load = function ($scope, customData) {
        $scope.$apply(function () {

            resetPlaybackScope($scope);
        });

        clearTimeouts();

        angular.extend($scope, customData);

        var requestUrl = getUrl($scope, 'Users/' + $scope.userId + '/Items/' + $scope.itemId);

        return $http.get(requestUrl).success(function (data) {

            $scope.item = data;

            var isSeries = !!data.SeriesName;
            var backdropUrl = '';

            if (data.BackdropImageTags && data.BackdropImageTags.length) {
                backdropUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.Id + '/Images/Backdrop/0?tag=' + data.BackdropImageTags[0];
            } else {
                if (data.ParentBackdropItemId && data.ParentBackdropImageTags && data.ParentBackdropImageTags.length) {
                    backdropUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.ParentBackdropItemId + '/Images/Backdrop/0?tag=' + data.ParentBackdropImageTags[0];
                }
            }

            var posterUrl = '';

            if (isSeries && data.SeriesPrimaryImageTag) {
                posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.SeriesId + '/Images/Primary?tag=' + data.SeriesPrimaryImageTag;
            }
            else if (data.AlbumPrimaryImageTag) {
                posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.AlbumId + '/Images/Primary?tag=' + (data.AlbumPrimaryImageTag);
            }
            else if (data.PrimaryImageTag) {
                posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.Id + '/Images/Primary?tag=' + (data.PrimaryImageTag);
            }
            else if (data.ImageTags.Primary) {
                posterUrl = $scope.serverAddress + '/mediabrowser/Items/' + data.Id + '/Images/Primary?tag=' + (data.ImageTags.Primary);
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

        }).then(function () {
            clearTimeouts();
        });
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

        }, 3500).then(function () {
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

function getReportingParams($scope) {

    var positionTicks = window.mediaElement.currentTime * 10000000;

    // TODO: Add starttime ticks if transcoding via progressive
    if (!$scope.canClientSeek) {
        var startTimeTicks = $scope.startTimeTicks || 0;
        positionTicks += (startTimeTicks * 1);
    }

    return {
        PositionTicks: positionTicks,
        IsPaused: window.mediaElement.paused,
        IsMuted: window.mediaElement.volume == 0,
        AudioStreamIndex: $scope.audioStreamIndex,
        SubtitleStreamIndex: $scope.subtitleStreamIndex,
        VolumeLevel: window.mediaElement.volume * 100,
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
        nowPlayingItem.MediaStreams = [];

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

function broadcastToMessageBus(msg) {

    window.playlistMessageBus.broadcast(msg);
}

//Controllers
module.controller('MainCtrl', function ($scope, mediaBrowserActions) {

    cast.receiver.logger.setLevelValue(cast.receiver.LoggerLevel.ERROR);

    var init = function () {

        resetPlaybackScope($scope);
        document.getElementById('video-player').src = "";
    };


    init();

    mediaBrowserActions.setApplicationClose();

    var mgr = window.mediaManager;
    mgr.onEnded = function () {
        mediaBrowserActions.setApplicationClose();
        mediaBrowserActions.reportPlaybackStopped($scope, getReportingParams($scope));
        mediaBrowserActions.stopTranscoding($scope);
        $scope.$apply(init);
    };

    var broadcastToServer = new Date();

    window.mediaElement.addEventListener('timeupdate', function () {

        var now = new Date();

        var elapsed = now - broadcastToServer;

        if (elapsed > 5000) {

            mediaBrowserActions.reportPlaybackProgress($scope, getReportingParams($scope));
            broadcastToServer = now;
        }
        else if (elapsed > 2000) {

            mediaBrowserActions.reportPlaybackProgress($scope, getReportingParams($scope), false);
        }

        if (elapsed > 1000) {

            $scope.$apply(function () {
                $scope.currentTime = window.mediaElement.currentTime;
            });
        }
    });

    mgr.defaultOnPlay = mgr.onPlay;
    mgr.onPlay = function (event) {
        mediaBrowserActions.play($scope, event);
        mediaBrowserActions.reportPlaybackStart($scope, getReportingParams($scope));
    };

    mgr.defaultOnPause = mgr.onPause;
    mgr.onPause = function (event) {
        mgr.defaultOnPause(event);
        mediaBrowserActions.pause($scope);
        mediaBrowserActions.reportPlaybackProgress($scope, getReportingParams($scope));
    };

    mgr.defaultOnStop = mgr.onStop;
    mgr.onStop = function (event) {
        mgr.defaultOnStop(event);
        mediaBrowserActions.stop($scope);
        mediaBrowserActions.reportPlaybackStopped($scope, getReportingParams($scope));
        mediaBrowserActions.stopTranscoding($scope);
    };

    console.log('Application is ready, starting system');

    window.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();

    // Create a custom namespace channel to receive commands from the sender
    // app to add items to a playlist
    window.playlistMessageBus = window.castReceiverManager.getCastMessageBus('urn:x-cast:com.google.cast.mediabrowser.v3', cast.receiver.CastMessageBus.MessageType.JSON);

    // Create a message handler for the custome namespace channel
    window.playlistMessageBus.onMessage = function (event) {

        console.log('Playlist message: ' + JSON.stringify(event));

        var data = event.data;
        data.options.senderId = event.senderId;
        for (var i = 0, length = data.options.items.length; i < length; i++) {
            data.options.items[i].userId = data.userId;
            data.options.items[i].accessToken = data.accessToken;
            data.options.items[i].serverAddress = data.serverAddress;
        }

        window.playOptions.maxBitrate = data.maxBitrate || window.playOptions.maxBitrate;

        if (data.command == 'PlayLast' || data.command == 'PlayNext') {
            queue(data, data.command);
        }
        else {
            playFromOptions(data.options);
        }
    };

    function queue(data, method) {
        window.playlist.push(data.items);
    }

    function playFromOptions(options) {

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

    function playItem(item, options) {

        //mediaBrowserActions.stopTranscoding($scope);

        $scope.$apply(function () {
            $scope.status = 'loading';
        });

        unloadPlayer();

        var streamInfo = getStreamInfo(item.serverAddress,
            $scope.deviceId,
            item,
            options.startTimeTicks,
            window.playOptions.maxBitrate,
            options.mediaSourceId,
            options.audioStreamIndex,
            options.subtitleStreamIndex);

        var url = streamInfo.url;
        while (window.mediaElement.firstChild) {
            window.mediaElement.removeChild(window.mediaElement.firstChild);
        }
        if(streamInfo.subtitleStreamUrl){
            var trackTag = document.createElement("track");
            trackTag.setAttribute('kind','subtitles');
            trackTag.setAttribute('src',streamInfo.subtitleStreamUrl);
            trackTag.setAttribute('default',"");
            window.mediaElement.appendChild(trackTag);
            window.mediaElement.textTracks[0].mode = "showing";
        }

        var mediaInfo = {
            customData: {
                startTimeTicks: options.startTimeTicks || 0,
                serverAddress: item.serverAddress,
                userId: item.userId,
                itemId: item.Id,
                mediaSourceId: streamInfo.mediaSource.Id,
                audioStreamIndex: streamInfo.mediaSource.audioStream ? streamInfo.mediaSource.audioStream.Index : null,
                subtitleStreamIndex: streamInfo.mediaSource.subtitleStream ? streamInfo.mediaSource.subtitleStream.Index : null,
                playMethod: streamInfo.isStatic ? 'DirectStream' : 'Transcode',
                runtimeTicks: streamInfo.mediaSource.RunTimeTicks,
                accessToken: item.accessToken,
                canSeek: streamInfo.canSeek
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

        mediaBrowserActions.load($scope, mediaInfo.customData).then(function () {

            var autoplay = true;

            mediaElement.autoplay = autoplay;

            // Create the Host - much of your interaction with the library uses the Host and
            // methods you provide to it.
            var host = new cast.player.api.Host({ 'mediaElement': window.mediaElement, 'url': url });

            // TODO: Add info from startTimeTicks
            var startSeconds = options.startTimeTicks ? (Math.floor(options.startTimeTicks / 10000000)) : 0;

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

                mediaBrowserActions.stopTranscoding($scope);

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

                var seekParam = startSeconds && streamInfo.canClientSeek ? '#t=' + (startSeconds) : '';
                window.mediaElement.src = url + seekParam;
                window.mediaElement.autoplay = true;

                window.mediaElement.load();
                if (autoplay) {
                    window.mediaElement.pause();
                    mediaBrowserActions.delayStart($scope);
                }
            }

            setMetadata(item, mediaInfo.metadata);

            // We use false as we do not want to broadcast the new status yet
            // we will broadcast manually when the media has been loaded, this
            // is to be sure the duration has been updated in the media element
            window.mediaManager.setMediaInformation(mediaInfo, false);
        });
    }

    window.castReceiverManager.start();
});
