'use strict';

/**
 * @ngdoc overview
 * @name chromecastApp
 * @description
 * # chromecastApp
 *
 * Main module of the application.
 */
angular
  .module('chromecastApp', [
    'ngAnimate',
    'ngRoute'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
      })
      .when('/about', {
        templateUrl: 'views/about.html',
        controller: 'AboutCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
