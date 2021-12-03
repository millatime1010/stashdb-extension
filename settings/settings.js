let addressElement = document.getElementById("address");
let apiElement = document.getElementById("apiKey");
let saveButton = document.getElementById("saveBtn");

chrome.storage.sync.get("address", ({ address }) => {
  if(address) {
    addressElement.value = address;
  } else {
    addressElement.value = "";
  }
});

chrome.storage.sync.get("apiKey", ({ apiKey }) => {
  if(apiKey) {
    apiElement.value = apiKey;
  } else {
    apiElement.value = "";
  }
});

saveButton.addEventListener("click", (event) => {
  if(addressElement.value) {
    chrome.storage.sync.set({"address": addressElement.value});
  }
  chrome.storage.sync.set({"apiKey": apiElement.value});
  window.close();
});