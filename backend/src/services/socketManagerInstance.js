let socketManagerInstance = null;

function setSocketManager(instance) {
  socketManagerInstance = instance;
}

function getSocketManager() {
  if (!socketManagerInstance) {
    throw new Error('SocketManager has not been initialized');
  }
  return socketManagerInstance;
}

function hasSocketManager() {
  return !!socketManagerInstance;
}

module.exports = {
  setSocketManager,
  getSocketManager,
  hasSocketManager
};
