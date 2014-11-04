'use strict';

describe('Directive: currentTime', function () {

  // load the directive's module
  beforeEach(module('chromecastApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<current-time></current-time>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the currentTime directive');
  }));
});
