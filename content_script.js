let mutationObserverSetup = false;
let isSearch = location.href.includes('/search/');
let isPerformer = location.href.includes('/performers/');
let isScene = location.href.includes('/scenes/');

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

function ignoreScene(linkElement, replaceIcon) {
  linkElement.addClass("stash_id_ignored");
  const cardElement = (isSearch || isScene) ? linkElement.find(".card") : linkElement.parents(".card");
  
  let sceneImage = cardElement.find(".SceneCard-image");

  if (isSearch) {
    sceneImage = cardElement.find(".SearchPage-scene-image");
  }
  if (isScene) {
    sceneImage = cardElement.find(".scene-photo-element");
  }

  sceneImage.css("opacity", ".25");
  cardElement.css("background-color", "rgba(48, 64, 77, 0.25)");

  if(replaceIcon) {
    const imageElement = linkElement.find(".stash_id_match img");
    imageElement.attr("src", chrome.runtime.getURL('images/ignore.svg'));
  }
}

function clearIgnore(linkElement) {
  linkElement.removeClass("stash_id_ignored");
  const cardElement = (isSearch || isScene) ? linkElement.find(".card") : linkElement.parents(".card");

  let sceneImage = cardElement.find(".SceneCard-image");

  if (isSearch) {
    sceneImage = cardElement.find(".SearchPage-scene-image");
  }
  if (isScene) {
    sceneImage = cardElement.find(".scene-photo-element");
  }

  sceneImage.css("opacity", "1");
  cardElement.css("background-color", "rgba(48, 64, 77, 1)");
  const imageElement = linkElement.find(".stash_id_match img");
  imageElement.attr("src", chrome.runtime.getURL('images/red_x.svg'));
}

async function run() {
  const store = await chrome.storage.sync.get();
  const address = store.address ? store.address : "http://localhost:9999";
  const ignoredScenes = store.ignoredScenes ? store.ignoredScenes : {};
 
  try {
    await sleepUntil(() => {
      if(isSearch) {
        return $(".SearchPage-scene").length > 0;
      } else if(isScene) {
        return $(".scene-info").length > 0;
      } {
        return $(".row .SceneCard").length > 0;
      }
    }, 10000);
  } catch(e) {
  }

  if(isPerformer) {
    if(!mutationObserverSetup) {
      //setup a mutation observer if we are on the performers page.
      //this may need to be adapted later for other pages.
      const tabContent = document.getElementsByClassName("tab-content")[0];
      let observer = new MutationObserver(mutations => {
        if(mutationObserverSetup) {
          for(let mutation of mutations) {
            //console.log(mutation);
            for(let addedNode of mutation.addedNodes) {
              if(addedNode.nodeName === 'SPAN' && addedNode.id && addedNode.id === 'aria-context') {
                run();
              }
              if(addedNode.className === 'row' && mutationObserverSetup) {
                run();
              }
            }
          }
        }
      });
      observer.observe(tabContent, { childList: true, subtree: true });
      mutationObserverSetup = true;
    }
  }

  const query = `query FindSceneByStashId($id: String!) { \n findScenes(scene_filter: {stash_id: {value: $id, modifier: EQUALS}}) {\n    scenes {\n      title\n      stash_ids {\n        endpoint\n        stash_id\n      }\n      id    }\n  }\n}`

  let sceneCardList =  $(".row .SceneCard");

  if (isSearch) {
    sceneCardList = $(".SearchPage-scene");
  }
  if (isScene) {
    sceneCardList = $(".StashDBContent");
  }

  for(let ndx = 0; ndx < sceneCardList.length; ++ndx) {
    const linkElement = (isSearch || isScene) ? $(sceneCardList[ndx]) : $(sceneCardList[ndx]).find('.d-flex');

    let id = null;

    if(isScene) {
      id = location.href.slice(location.href.lastIndexOf('/') + 1);
    } else {
      const linkHref = linkElement.attr('href');
      id = linkHref.split('/')[2];
    }

    chrome.runtime.sendMessage({msg: "queryLocalStash", query: { query, variables: { id } } }, results => {
        
      let display = isSearch ?  $("<div>", { class: "stash_id_match", style: "position: absolute; top: 10px; right: 5px;"}) : 
                                $("<div>", { class: "stash_id_match", style: "position: relative; margin-left: 10px; cursor: pointer"})

      let new_link = $("<a>");
      let new_image = $("<img>", { style: "height: 20px; width: 20px;"});
      display.append(new_link);
      new_link.append(new_image);
      if(id in ignoredScenes) {
        new_image.attr('src', chrome.runtime.getURL('images/ignore.svg'));
        ignoreScene(linkElement, false);
      } else {
        if(results.data.findScenes.scenes.length) {
          new_image.attr('src', chrome.runtime.getURL('images/green_check.svg'));
          new_link.attr('href', address + "/scenes/" + results.data.findScenes.scenes[0].id);
        } else {
          new_image.attr('src', chrome.runtime.getURL('images/red_x.svg'));
        }
      }
    
      new_link.on("click", (event) => {
        event.stopImmediatePropagation();
      });

      display.hover(
        function() {
          let dropdown = $("<div>", { 
            class:"menu", 
            style: "height: 55px; width: 40px; background: transparent; position: fixed; z-index: 1"});

          const top = $(this).offset().top - $(document).scrollTop()
          dropdown.css("top", (top - 10) + 'px')
          dropdown.css("left", $(this).offset().left + 'px')

          let menu = $("<div>", { class: "dropdown-menu", style: "display: block; background: white; position: absolute; top: 0; left: 25px"});

          dropdown.on("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
          });

          if(new_link.attr('href') !== undefined) {
            let gotoScene =  $("<a>", { class: "dropdown-item"});
            gotoScene.text("Go to Scene");

            gotoScene.on("click", (event) => {
              event.preventDefault();
              event.stopImmediatePropagation();
              location.href = new_link.attr('href');
            });
            menu.append(gotoScene);
          }
          if(new_link.attr('href') === undefined) {
            let ignoreLink = $("<a>", { class: "dropdown-item"});

            if(linkElement.hasClass("stash_id_ignored")) {
              ignoreLink.text("Clear Ignore");
              
              ignoreLink.on("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                delete ignoredScenes[id];
                chrome.storage.sync.set({"ignoredScenes": ignoredScenes});
                clearIgnore(linkElement);
                menu.remove();
              });

              menu.append(ignoreLink);
            } else {
              ignoreLink.text("Ignore Scene");

              ignoreLink.on("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                ignoredScenes[id] = true;
                chrome.storage.sync.set({"ignoredScenes": ignoredScenes});
                ignoreScene(linkElement, true);
                menu.remove();
              });
            }
            menu.append(ignoreLink);
          }
          dropdown.append(menu);
          $(this).append(dropdown);
        },
        function() {
          $(this).find(".menu").remove();
        }
      );
      linkElement.find('.stash_id_match').remove();

      if (isSearch) {
        linkElement.find(".card h5").append(display);
      } else if(isScene) {
        linkElement.find(".card-header .float-right").append(display);
      } else {
        linkElement.append(display);
      }
    });
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message === 'TabUpdated') {
    mutationObserverSetup = false;
    isSearch = location.href.includes('/search/');
    isPerformer = location.href.includes('/performers/');
    isScene = location.href.includes('/scenes/')
    run();
  }
});
