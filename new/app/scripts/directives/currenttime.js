'use strict';

/**
 * @ngdoc directive
 * @name chromecastApp.directive:currentTime
 * @description
 * # currentTime
 */
angular.module('chromecastApp')
  .directive('currentTime', function ($interval, dateFilter) {
    function link (scope, element, attrs) {
      var format,
        timeoutId;

      function updateTime() {
        element.text(dateFilter(new Date(), format || 'h:mm a'));
      }

      scope.$watch(attrs.myCurrentTime, function(value) {
        format = value;
        updateTime();
      });

      element.on('$destroy', function() {
        $interval.cancel(timeoutId);
      });

      // start the UI update process; save the timeoutId for canceling
      timeoutId = $interval(function() {
        updateTime(); // update DOM
      }, 1000);
    }
    return {
      link: link
    };
  });
