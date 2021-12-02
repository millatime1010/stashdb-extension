async function sleepUntil(f, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timeWas = new Date();
    let wait = setInterval(function() {
      if (f()) {
        console.log("resolved after", new Date() - timeWas, "ms");
        clearInterval(wait);
        resolve();
      } else if (new Date() - timeWas > timeoutMs) { 
          // Timeout
          console.log("rejected after", new Date() - timeWas, "ms");
          clearInterval(wait);
          reject();
      }
    }, 20);    
  });
}

async function run() {
  const store = await chrome.storage.sync.get();
  const address = store.address ? store.address : "http://localhost:9999";
 
  try {
    await sleepUntil(() => {
      return $(".row .SceneCard").length > 0
    }, 10000);
  } catch(e) {
  }

  const query = `query FindSceneByStashId($id: String!) { \n findScenes(scene_filter: {stash_id: {value: $id, modifier: EQUALS}}) {\n    scenes {\n      title\n      stash_ids {\n        endpoint\n        stash_id\n      }\n      id    }\n  }\n}`

  const sceneCardList = $(".row .SceneCard");

  for(let ndx = 0; ndx < sceneCardList.length; ++ndx) {
    const linkElement = $(sceneCardList[ndx]).find('.d-flex');
    const linkHref = linkElement.attr('href');
    const id = linkHref.split('/')[2];

    chrome.runtime.sendMessage({msg: "queryLocalStash", query: { query, variables: { id } } }, results => {
        
      let display = $("<div>", { class: "stash_id_match", style: "position: relative; margin-left: 10px"})
      let new_link = $("<a>");
      let new_image = $("<img>", { style: "height: 20px; width: 20px;"});
      display.append(new_link);
      new_link.append(new_image);
      if(results.data.findScenes.scenes.length) {
        new_image.attr('src', chrome.runtime.getURL('images/green_check.svg'));
        new_link.attr('href', address + "/scenes/" + results.data.findScenes.scenes[0].id);
      } else {
        new_image.attr('src', chrome.runtime.getURL('images/red_x.svg'));
      }
    
      new_link.on("click", (event) => {
        event.stopImmediatePropagation();
      });
  
      linkElement.find('.stash_id_match').remove();
      linkElement.append(display);
    });
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message === 'TabUpdated') {
    run();
  }
});
