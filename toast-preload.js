const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toastAPI', {
    onToastClicked: (notificationId) => ipcRenderer.send('toast-clicked', notificationId),
    onNotificationData: (callback) => ipcRenderer.on('notification-data', (event, data) => callback(data)),
    resizeToast: (width, height) => ipcRenderer.send('resize-toast', width, height),
});
