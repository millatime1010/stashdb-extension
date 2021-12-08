
async function run() {
  await setupScenes();
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message === 'TabUpdated') {
    updateSceneVars();
    run();
  }
});
