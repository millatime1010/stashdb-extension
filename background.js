async function queryLocalStash(request) {
  const store = await chrome.storage.sync.get();
  const address = store.address ? store.address : "http://localhost:9999";

  const headers = {
    "Content-Type": "application/json"
  }
  if(store.apiKey && store.apiKey.length > 0) {
    headers["ApiKey"] = store.apiKey;
  }

  const response = await fetch(address + "/graphql", {
    body: JSON.stringify(request.query),
    headers: headers,
    method: "POST"
  });
  const results = await response.json();

  return results;
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, {
      message: 'TabUpdated'
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.msg == "queryLocalStash") {
    queryLocalStash(request).then(sendResponse);
  }
  return true;
});
