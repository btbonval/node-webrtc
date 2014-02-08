#!/usr/bin/env node

var os = require('os')
  , fs = require('fs')
  , spawn = require('child_process').spawn
  , RSVP = require('rsvp');

var PROJECT_DIR = process.cwd()
  , DEPOT_TOOLS_REPO = 'https://chromium.googlesource.com/chromium/tools/depot_tools.git'
  , LIB_WEBRTC_DIR_REPO = 'http://webrtc.googlecode.com/svn/trunk'
  , LIB_DIR = PROJECT_DIR + '/third_party'
  , LIB_WEBRTC_DIR = LIB_DIR + '/libwebrtc'
  , TOOLS_DIR = PROJECT_DIR + '/tools'
  , TOOLS_DEPOT_TOOLS_DIR = TOOLS_DIR + '/depot_tools'
  , GCLIENT = TOOLS_DEPOT_TOOLS_DIR + '/gclient'
  , NINJA = TOOLS_DEPOT_TOOLS_DIR + '/ninja'
  , NODE_GYP = PROJECT_DIR + '/node_modules/node-gyp/bin/node-gyp.js'
  , VERBOSE = false;

process.env['GYP_GENERATORS'] = NINJA;

var arguments = process.argv.slice(2);
arguments.include = function(obj) {
  return (this.indexOf(obj) != -1);
}

if(arguments.length > 0) {

  if (arguments.include('-v') ||
    arguments.include('--verbose')) {

    VERBOSE = true;
  }

  if (arguments.include('-h') ||
    arguments.include('--help')) {

    process.stdout.write('node-webrtc build script usage:\r\n' +
      '\t-v, --verbose: switch on verbose mode (suggested on build failure);\r\n' +
      '\t-h, --help: print this help.' +
      '\r\n');
    process.exit();
  }
}

var processOutput = function(spawnedProcess, processType) {
      return new RSVP.Promise(function(resolve, reject) {
        spawnedProcess.stdout
        .on('data', function(data) {

          if (VERBOSE) {

            process.stdout.write(data);
          } else {

            process.stdout.write('.');
          }
        })
        .on('error', function(error) {

          reject('Error during ' + processType + '\r\n' + error + '\r\n');
        })
        .on('end', function() {

          if (VERBOSE) {

            process.stdout.write('\r\n' + processType + ' finished\r\n');
          } else {

            process.stdout.write('.\r\n');
          }

          resolve();
        });

      spawnedProcess.stderr
        .on('data', function(data) {

          if (VERBOSE) {

            process.stdout.write(data);
          } else {

            process.stdout.write('.');
          }
        });

        spawnedProcess.on('exit', function(code, signal) {
          if (code !== undefined &&
            code !== 0) {

            reject('Something went wrong.\r\n\tTry to run build script with --verbose option to find the possible problem.')
          }
        });
      });
    }
  , downloadDepotTools = function() {
      return new RSVP.Promise(function(resolve, reject) {

        process.stdout.write('Going to eventually download depot tools from ' +
          DEPOT_TOOLS_REPO + ' in ' + TOOLS_DEPOT_TOOLS_DIR + '\r\n');

        if (!fs.existsSync(TOOLS_DIR)) {

          fs.mkdirSync(TOOLS_DIR);
        }

        process.chdir(TOOLS_DIR);
        if(!fs.existsSync(TOOLS_DEPOT_TOOLS_DIR)) {

          var gitCloneDepotTools = spawn('git', [
            'clone', '-v', '--progress', DEPOT_TOOLS_REPO]);

          processOutput(gitCloneDepotTools, 'cloning depot tools').then(function(){

            resolve();
          }, function(rejectionInfo) {

            reject(rejectionInfo);
          });
        } else {

          if (VERBOSE) {

            process.stdout.write('You already have depot tools, going on...\r\n');
          } else {

            process.stdout.write('.');
          }
          resolve();
        }
      });
    }
  , runGclientConfig = function() {
      return new RSVP.Promise(function(resolve, reject) {

        process.stdout.write('Going to run the depot tools command: ' +
          GCLIENT + ' config ' + LIB_WEBRTC_DIR_REPO + ' in folder ' + LIB_WEBRTC_DIR + ' \r\n');

        if(!fs.existsSync(LIB_WEBRTC_DIR)) {

          if(!fs.existsSync(LIB_DIR)) {

            fs.mkdirSync(LIB_DIR);
          }

          fs.mkdirSync(LIB_WEBRTC_DIR);
        }
        process.chdir(LIB_WEBRTC_DIR);

        var gclientConfig = spawn(GCLIENT, [
          'config',
          LIB_WEBRTC_DIR_REPO]);

        var processName = GCLIENT + ' config ' + LIB_WEBRTC_DIR_REPO;
        processOutput(gclientConfig, processName).then(function(){

            resolve();
          }, function(rejectionInfo) {

            reject(rejectionInfo);
          });
      });
    }
  , runGclientSync = function() {
      return new RSVP.Promise(function(resolve, reject) {

        process.stdout.write('Going to run the depot tools command: '+
          GCLIENT + ' sync in folder '+ LIB_WEBRTC_DIR + '\r\n');

        process.chdir(LIB_WEBRTC_DIR);
        var gclientSync = spawn(GCLIENT, ['sync']);

        var processName = GCLIENT + ' sync';
        processOutput(gclientSync, processName).then(function(){

            resolve();
          }, function(rejectionInfo) {

            reject(rejectionInfo);
          });
      });
    }
  , runGlientRunHooks = function() {
      return new RSVP.Promise(function(resolve, reject) {

        process.stdout.write('Going to run the depot tools command: '+
          GCLIENT + ' runhooks in folder '+ LIB_WEBRTC_DIR + '\r\n');

        process.chdir(LIB_WEBRTC_DIR);
        var gclientRunHooks = spawn(GCLIENT, ['runhooks']);

        var processName = GCLIENT + ' runhooks';
        processOutput(gclientRunHooks, processName).then(function(){

            resolve();
          }, function(rejectionInfo) {

            reject(rejectionInfo);
          });
      });
    }
  , runNinja = function() {
      return new RSVP.Promise(function(resolve, reject) {

        var buildedName = ''
        if('linux' == os.platform()) {

          buildedName = 'peerconnection_client';
        }

        process.stdout.write('Going to run the depot tools command: ' +
          NINJA + ' -C trunk/out/Release ' + buildedName + ' in folder '+ LIB_WEBRTC_DIR + '\r\n');

        process.chdir(LIB_WEBRTC_DIR);
        var ninja = spawn(NINJA, ['-C', 'trunk/out/Release', buildedName]);

        var processName = NINJA;
        processOutput(ninja, processName).then(function(){

            resolve();
          }, function(rejectionInfo) {

            reject(rejectionInfo);
          });
      });
    }
  , runNodeGypBuild = function() {
      return new RSVP.Promise(function(resolve, reject) {

        process.stdout.write('Going to run commnad: ' + NODE_GYP + ' rebuild in folder '+ PROJECT_DIR + '\r\n');

        process.chdir(PROJECT_DIR);
        var nodeGyp = spawn(NODE_GYP, ['rebuild']);

        var processName = NODE_GYP;
        processOutput(nodeGyp, processName).then(function(){

            resolve();
          }, function(rejectionInfo) {

            reject(rejectionInfo);
          });
      });
    };

downloadDepotTools().then(function() {

  return runGclientConfig();
}).then(function() {

  return runGclientSync();
}).then(function() {

  return runGlientRunHooks();
}).then(function() {

  return runNinja();
}).then(function() {

  return runNodeGypBuild();
}).then(function() {

  process.stdout.write('wrtc module build complete\r\n');
  process.exit(0);
}).catch(function(rejectionInfo) {

  process.stderr.write(rejectionInfo);
  process.exit(1);
});
