'use strict';

/**
 * @ngdoc overview
 * @name mediaBrowserchromecastApp
 * @description
 * # mediaBrowserchromecastApp
 *
 * Main module of the application.
 */
angular
  .module('mediaBrowserchromecastApp', [
    'ngAnimate',
    'ngResource',
    'ngRoute',
    'ngSanitize'
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
