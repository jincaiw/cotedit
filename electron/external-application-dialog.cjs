'use strict';

function createExternalApplicationDialogOptions(platform = process.platform) {
  const options = {
    title: '选择要打开文件的应用',
    buttonLabel: '使用此应用打开',
    properties: ['openFile']
  };
  if (platform === 'darwin') {
    options.defaultPath = '/Applications';
    options.treatPackageAsDirectory = false;
    options.filters = [{ name: '应用程序', extensions: ['app'] }];
  } else if (platform === 'win32') {
    options.filters = [{ name: '应用程序', extensions: ['exe'] }];
  }
  return options;
}

module.exports = { createExternalApplicationDialogOptions };
