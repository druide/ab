/*!
 * ab - lib/ab.js
 * Copyright(c) 2013 fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var debug = require('debug')('ab');
var microtime = require('microtime');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var fs = require('fs');
var path = require('path');

var pkg = require('../package.json');
var HEAD = fs.readFileSync(path.join(__dirname, 'tpl', 'head.txt'), 'utf8');
var REPORT = fs.readFileSync(path.join(__dirname, 'tpl', 'report.txt'), 'utf8');

exports.run = function (fn, options) {
  return new Benchmark(fn, options).run();
};

function Benchmark(fn, options) {
  EventEmitter.call(this);
  this.fn = fn;
  options = options || {};
  this.requests = options.requests || 100;
  this._stageCount = this.requests / 10;
  this.concurrency = options.concurrency || 5;
  this._finished = 0;
  this._sent = 0;
  this._fail = 0;
  this._errors = 0;
  this._rts = [];
}

util.inherits(Benchmark, EventEmitter);

Benchmark.prototype.run = function () {
  var that = this;
  var startTime = Date.now();
  this.on('done', function (id) {
    debug('#%d done', id);
    if (that._finished !== that.requests) {
      return;
    }

    var totalUse = Date.now() - startTime;
    var minRT = null;
    var maxRT = null;
    var rtCounts = {'1000+': 0};
    var times = [
      0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50, 100, 200, 500, 1000
    ];
    for (var i = 0; i < times.length; i++) {
      rtCounts[times[i]] = 0;
    }

    var rts = that._rts;
    var totalRT = 0;
    for (var i = 0; i < rts.length; i++) {
      var rt = rts[i] / 1000;
      totalRT += rt;
      if (minRT === null || minRT > rt) {
        minRT = rt;
      }
      if (maxRT === null || maxRT < rt) {
        maxRT = rt;
      }
      var hit = false;
      for (var j = 0; j < times.length; j++) {
        var t = times[j];
        if (rt <= t) {
          rtCounts[t] = (rtCounts[t] || 0) + 1;
          hit = true;
          break;
        }
      }
      if (!hit) {
        rtCounts['1000+']++;
      }
    }

    var avgRT = (totalRT / that.requests).toFixed(3);
    var qps = (that.requests / totalUse * 1000).toFixed(3);
    var total = that._finished;
    var rates = {};
    for (var t in rtCounts) {
      rates[t] = (rtCounts[t] / total * 100).toFixed(1);
    }

    console.log(REPORT, total, Date(), that.concurrency, (totalUse / 1000).toFixed(3),
      total, that._fail, that._errors, qps, avgRT, minRT, maxRT,
      rtCounts['0.5'], rates['0.5'], 
      rtCounts['1'], rates['1'],
      rtCounts['2'], rates['2'],
      rtCounts['3'], rates['3'],
      rtCounts['4'], rates['4'],
      rtCounts['5'], rates['5'],
      rtCounts['6'], rates['6'],
      rtCounts['7'], rates['7'],
      rtCounts['8'], rates['8'],
      rtCounts['9'], rates['9'],
      rtCounts['10'], rates['10'],
      rtCounts['15'], rates['15'],
      rtCounts['20'], rates['20'],
      rtCounts['30'], rates['30'],
      rtCounts['50'], rates['50'],
      rtCounts['100'], rates['100'],
      rtCounts['200'], rates['200'],
      rtCounts['500'], rates['500'],
      rtCounts['1000'], rates['1000'],
      rtCounts['1000+'], rates['1000+']
    );
    that.emit('end');
  });

  for (var i = 0; i < that.concurrency; i++) {
    that.next(i);
  }

  var author = pkg.author.name + ' ' + pkg.author.email + ' ' + pkg.author.url;
  console.log(HEAD, pkg.name, pkg.description, pkg.version, author, pkg.license);
  return this;
};

Benchmark.prototype.next = function (id) {
  var fn = this.fn;
  var that = this;
  var start = microtime.now();
  if (that._sent === that.requests) {
    return that.emit('done', id);
  }
  that._sent++;
  fn(function (err, success) {
    var use = microtime.now() - start;
    that._rts.push(use);
    that._finished++;
    if (that._finished % that._stageCount === 0) {
      console.log('Completed %d requests', that._finished);
    }

    if (err) {
      that._errors++;
      that.emit('error', err);
    }
    if (!success) {
      that._fail++;
    }
    that.next(id);
  });
};
