'use strict';

/**
 * @ngdoc function
 * @name chromecastApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the chromecastApp
 */
angular.module('chromecastApp')
  .controller('MainCtrl', function ($scope) {
    $scope.versionNumber = '2.0.001';
    $scope.waitingbackdrop = '';
  });
