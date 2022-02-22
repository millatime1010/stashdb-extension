let mutationObserverSetup = false;
let isSearch = location.href.includes('/search/');
let isPerformer = location.href.includes('/performers/');
let isScene = location.href.includes('/scenes/');

const debounceRun = debounce(function() {
  setupScenes();
}, 200);

function ignoreScene(linkElement, replaceIcon) {
  linkElement.addClass("stash_id_ignored");
  const cardElement = (isSearch || isScene) ? linkElement.find(".card") : linkElement.parents(".card");
  
  let sceneImage = cardElement.find(".SceneCard-image");

  if (isSearch) {
    sceneImage = cardElement.find(".SearchPage-scene-image");
  }
  if (isScene) {
    sceneImage = cardElement.find(".Image-image");
  }

  sceneImage.css("opacity", ".25");
  cardElement.css("background-color", "rgba(48, 64, 77, 0.25)");

  if(replaceIcon) {
    const imageElement = linkElement.find(".stash_id_match img");
    imageElement.attr("src", chrome.runtime.getURL('images/ignore.svg'));
  }
}

function favoriteScene(linkElement, icon) {
  linkElement.addClass("stash_id_wanted");
  if (icon) {
    const imageElement = linkElement.find(".stash_id_match img");
    imageElement.attr("src", chrome.runtime.getURL('images/yellow_star.svg'));
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
    sceneImage = cardElement.find(".Image-image");
  }

  sceneImage.css("opacity", "1");
  cardElement.css("background-color", "rgba(48, 64, 77, 1)");
  const imageElement = linkElement.find(".stash_id_match img");
  imageElement.attr("src", chrome.runtime.getURL('images/red_x.svg'));
}

function clearFavorite(linkElement) {
  linkElement.removeClass("stash_id_wanted");
  const cardElement = (isSearch || isScene) ? linkElement.find(".card") : linkElement.parents(".card");

  const imageElement = linkElement.find(".stash_id_match img");
  imageElement.attr("src", chrome.runtime.getURL('images/red_x.svg'));
}

function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}


async function setupScenes() {
  const store = await chrome.storage.sync.get();
  const scene_store = await chrome.storage.local.get();
  const address = store.address ? store.address : "http://localhost:9999";
  
  if(store.ignoredScenes) {
    await chrome.storage.local.set({"ignoredScenes": store.ignoredScenes});
    await chrome.storage.sync.remove("ignoredScenes");
  }

  const ignoredScenes = scene_store.ignoredScenes ? scene_store.ignoredScenes : {};
  const favoritedScenes = scene_store.favoritedScenes ? scene_store.favoritedScenes : {};

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
            for(let addedNode of mutation.addedNodes) {
              if(addedNode.nodeName === 'DIV' && addedNode.className === 'col-3 SceneCard') {
                debounceRun();
              }
              if(addedNode.className === 'row') {
                debounceRun();
              }
            }
            for(let removedNode of mutation.removedNodes) {
              if(removedNode.nodeName === 'DIV' && removedNode.className === 'col-3 SceneCard') {
                debounceRun();
              }
            }
          }
        }
      });
      observer.observe(tabContent, { childList: true, subtree: true });
      mutationObserverSetup = true;
    }
  }

  if(isScene) {
    $('thead td').click(function(){
      var table = $(this).parents('table').eq(0)
      var rows = table.find('tr:gt(0)').toArray().sort(comparer($(this).index()))
      this.asc = !this.asc
      if (!this.asc){rows = rows.reverse()}
      for (var i = 0; i < rows.length; i++){table.append(rows[i])}
  })
    function comparer(index) {
      return function(a, b) {
          var valA = getCellValue(a, index), valB = getCellValue(b, index)
          return $.isNumeric(valA) && $.isNumeric(valB) ? valA - valB : valA.toString().localeCompare(valB)
      }
    }
    function getCellValue(row, index){ return $(row).children('td').eq(index).text() }
  }


  const query = [`query FindSceneByStashId($id: String!) { \n`,
                 `  findScenes(scene_filter: {stash_id: {value: $id, modifier: EQUALS}}) {\n`,
                 `    scenes {\n`,
                 `      title\n`,
                 `      stash_ids {\n`,
                 `        endpoint\n`,
                 `        stash_id\n`,
                 `      }\n`,
                 `      id    }\n`,
                 `  }\n`,
                 `}`].join('');

  let sceneCardList =  $(".row .SceneCard");

  if (isSearch) {
    sceneCardList = $(".SearchPage-scene");
  }
  if (isScene) {
    sceneCardList = $(".MainContent");
  }

  for(let ndx = 0; ndx < sceneCardList.length; ++ndx) {
    const linkElement = (isSearch || isScene) ? $(sceneCardList[ndx]) : $(sceneCardList[ndx]).find('.d-flex');

    let id = null;

    if(isScene) {
      id = location.href.slice(location.href.lastIndexOf('/') + 1);
      id = id.split("#")[0];
    } else if(isSearch) {
      const linkHref = linkElement.attr('href');
      id = linkHref.split('/')[2];
    } else {
      const linkHref = linkElement.find("a").attr('href');
      id = linkHref.split('/')[2];
    }

    chrome.runtime.sendMessage({msg: "queryLocalStash", query: { query, variables: { id } } }, results => {
        
      let display = isSearch ?  $("<div>", { class: "stash_id_match", style: "position: absolute; top: 10px; right: 5px; align-self: center;"}) : 
                                $("<div>", { class: "stash_id_match", style: "position: relative; margin-left: 10px; cursor: pointer; align-self: center;"});
                              

      let new_link = $("<a>");
      let new_image = $("<img>", { style: "height: 20px; width: 20px;"});
      display.append(new_link);
      new_link.append(new_image);
      if(id in ignoredScenes) {
        new_image.attr('src', chrome.runtime.getURL('images/ignore.svg'));
        ignoreScene(linkElement, false);
      } else if(id in favoritedScenes) {
        new_image.attr('src', chrome.runtime.getURL('images/yellow_star.svg'));
        favoriteScene(linkElement, false);
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
            style: "height: 55px; width: 40px; background: transparent; position: fixed; z-index: 1;"});

          const top = $(this).offset().top - $(document).scrollTop()
          dropdown.css("top", (top - 10) + 'px')
          dropdown.css("left", $(this).offset().left + 'px')

          let menu = $("<div>", { 
            class: "dropdown-menu", 
            style: "display: flex; flex-direction: column; background: white; position: absolute; top: 5px; left: 25px; padding: 8px; border-radius: 4px; width: 180px; font-size: 14px; font-weight: normal"});

          dropdown.on("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
          });

          if(new_link.attr('href') !== undefined) {
            let gotoScene =  $("<a>", { class: "dropdown-item", style: "color: black; padding: 5px; text-decoration: none"});
            gotoScene.text("Go to Scene");

            gotoScene.on("click", (event) => {
              event.preventDefault();
              event.stopImmediatePropagation();
              location.href = new_link.attr('href');
            });
            menu.append(gotoScene);
          }

          if(new_link.attr('href') === undefined) {
            let favoriteLink = $("<a>", { class: "dropdown-item", style: "color: black; padding: 5px; text-decoration: none"});
            let ignoreLink = $("<a>", { class: "dropdown-item", style: "color: black; padding: 5px; text-decoration: none"});

            if(linkElement.hasClass("stash_id_ignored")) {
              ignoreLink.text("Clear Ignore");
              
              ignoreLink.on("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                delete ignoredScenes[id];
                chrome.storage.local.set({"ignoredScenes": ignoredScenes});
                clearIgnore(linkElement);
                menu.remove();
              });

              menu.append(ignoreLink);
            } else if(linkElement.hasClass("stash_id_wanted")) {
              favoriteLink.text("Remove From Wishlist");

              favoriteLink.on("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                delete favoritedScenes[id];
                chrome.storage.local.set({"favoritedScenes": favoritedScenes});
                clearFavorite(linkElement);
                menu.remove();
              });

            } else {
              favoriteLink.text("Add to Wishlist");
              ignoreLink.text("Ignore Scene");

              ignoreLink.on("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                ignoredScenes[id] = true;
                chrome.storage.local.set({"ignoredScenes": ignoredScenes});
                ignoreScene(linkElement, true);
                menu.remove();
              });

              favoriteLink.on("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                favoritedScenes[id] = true;
                chrome.storage.local.set({"favoritedScenes": favoritedScenes});
                favoriteScene(linkElement, true);
                menu.remove();
              });
            }
            if (!linkElement.hasClass("stash_id_ignored")) {
              menu.append(favoriteLink);
            }
            if (!linkElement.hasClass("stash_id_wanted")) {
              menu.append(ignoreLink);
            }
          }
          dropdown.append(menu);
          $(this).append(dropdown);

          if(!isInViewport(menu.get()[0])) {
            dropdown.css("left", $(this).offset().left - 15 + 'px')
            $(menu).css("left", "-100px");
          }

        },
        function() {
          $(this).find(".menu").remove();
        }
      );
      linkElement.find('.stash_id_match').remove();

      if (isSearch) {
        linkElement.find(".card h5").append(display);
      } else if(isScene) {
        linkElement.find(".card-header .float-end").append(display);
      } else {
        linkElement.append(display);
      }
    });
  }
}

function updateSceneVars() {
  mutationObserverSetup = false;
  isSearch = location.href.includes('/search/');
  isPerformer = location.href.includes('/performers/');
  isScene = location.href.includes('/scenes/')
}