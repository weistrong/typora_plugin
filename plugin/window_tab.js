(() => {
    const config = {
        checkInterval: 30,
        requireVarName: "__PLUGIN_REQUIRE__",
        electronVarName: "__PLUGIN_ELECTRON__"
    }

    const Package = {
        // Typora常用的第一方内置库
        File: File,
        Client: ClientCommand,

        // node标准库
        Path: reqnode('path'),
        Fs: reqnode('fs'),

        // 劫持过来的electron核心库
        getElectron: () => global[config.electronVarName],
        getRequire: () => global[config.requireVarName],
    }

    const execForWindow = (winId, js) => JSBridge.invoke("executeJavaScript", winId, js);
    const execForAllWindows = js => Package.Client.execForAll(js);

    const getAPP = () => Package.getElectron().app;
    const getBrowserWindow = () => Package.getElectron().BrowserWindow;
    const getIPC = () => Package.getElectron().ipcMain;

    const getAllWindows = () => getBrowserWindow().getAllWindows();
    const getFocusedWindowId = () => getAPP().getCurrentFocusWindowId();
    const rangeWindow = func => {
        const windows = getAllWindows();
        for (const win of windows) {
            if (func(win)) {
                return
            }
        }
    }
    const getFocusedWindow = () => {
        let focused = getFocusedWindowId();
        const windows = getAllWindows();
        for (const win of windows) {
            if (win.id === focused) {
                return win
            }
        }
    }
    const setFocusWindow = winId => {
        rangeWindow(win => {
            if (win.id === winId) {
                win.focus();
                return true
            }
        })
    };

    const getDocumentController = () => getAPP().getDocumentController();
    const getDocument = id => getDocumentController().getDocumentFromWindowId(id);

    // hijack electron instance and require function in Typora backend
    setTimeout(() => {
        execForAllWindows(`
            if (!global["${config.electronVarName}"]) {
                global.${config.requireVarName} = global.reqnode('electron').remote.require;
                global.${config.electronVarName} = ${config.requireVarName}('electron');
            }`
        )
    });

    (() => {
        // insert css
        const title_bar_css = `
        #title-bar-window-tabs {
            position: absolute;
            left: 100px;
            -webkit-app-region: no-drag;
            width: 75%;
            height: 24px;
            margin-left: 10px;
            margin-right: 10px;
            z-index: 9999;
        }
        
        #title-bar-window-tabs .title-bar-window-tabs-list {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            justify-content: center;
            align-items: center;
            align-items:stretch;
            height: 24px;
        }
        
        #title-bar-window-tabs .title-bar-window-tab {
            flex-grow: 1;
            max-width: 200px;
            text-align: center;
            border-style: dashed;
            border-width: 1px;
            border-color: var(--mid-7);
            margin-right: -1px;
            cursor: pointer;
        }
        
        #title-bar-window-tabs .title-bar-window-tab.select {
            background-color: #ffafa3;
        }
        
        #title-bar-window-tabs .title-bar-window-tab:hover {
            background-color: #ffd4cc;
        }
        
        #title-bar-window-tabs .title-bar-window-tab .window-tab-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = title_bar_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        // insert html
        const title_bar_div = `<div class="title-bar-window-tabs-list"></div>`
        const windowTabs = document.createElement("div");
        windowTabs.id = 'title-bar-window-tabs';
        windowTabs.innerHTML = title_bar_div;
        const titleBarLeft = document.getElementById("w-titlebar-left");
        titleBarLeft.parentNode.insertBefore(windowTabs, titleBarLeft.nextSibling);
    })()

    const windowTabs = {
        list: document.querySelector(".title-bar-window-tabs-list"),
        titleText: document.getElementById('title-text'),
    }

    global.flushWindowTabs = (excludeId) => {
        const windows = getAllWindows();
        const focusWinId = getFocusedWindowId();
        const copy = [...windows];
        const sortedWindows = copy.sort((a, b) => a.id - b.id);

        windowTabs.list.innerHTML = "";
        const divArr = sortedWindows.map(win => {
            if (excludeId && win.id === excludeId) {
                return ""
            }
            const name = cleanName(win.getTitle());
            let selected = win.id === focusWinId ? "select" : "";
            return `<div class="title-bar-window-tab ${selected}" winId="${win.id}"><div class="window-tab-name">${name}</div></div>`
        })
        windowTabs.list.innerHTML = divArr.join("");
    }

    const loopDetect = (check, after) => {
        const timer = setInterval(() => {
            if (check()) {
                clearInterval(timer);
                after()
            }
        }, config.checkInterval)
    }

    const onElectronLoad = func => {
        loopDetect(
            () => Package.getElectron() && Package.getRequire(),
            () => func(Package.getRequire(), Package.getElectron())
        )
    }

    const cleanName = name => {
        name = name.replace("- Typora", "").trim();
        const idx = name.lastIndexOf(".");
        if (idx !== -1) {
            name = name.substring(0, idx);
        }
        return name
    }

    onElectronLoad((require, electron) => {
        execForAllWindows(`global.flushWindowTabs()`);
    })

    window.addEventListener("beforeunload", ev => {
        const focusWinId = getFocusedWindowId();
        execForAllWindows(`global.flushWindowTabs(${focusWinId})`)
    }, true)

    windowTabs.list.addEventListener("click", ev => {
        const target = ev.target.closest(".title-bar-window-tab");
        if (!target) {
            return
        }
        const winId = target.getAttribute("winId");
        setFocusWindow(parseInt(winId));
    })

    new MutationObserver((mutations) => {
        execForAllWindows(`global.flushWindowTabs()`);
    }).observe(windowTabs.titleText, {childList: true});

    // document.addEventListener('visibilitychange', () => {
    //     console.log("123");
    //     // 用户离开了当前页面
    //     if (document.visibilityState === 'hidden') {
    //         document.title = '页面不可见';
    //     }
    //
    //     // 用户打开或回到页面
    //     if (document.visibilityState === 'visible') {
    //         const focusWinId = getFocusedWindowId()
    //         const tabs = windowTabs.list.querySelectorAll(`.title-bar-window-tab`);
    //         for (const tab of tabs) {
    //             const winId = tab.getAttribute("winId");
    //             if (winId !== focusWinId) {
    //                 tab.classList.remove("select");
    //             } else {
    //                 tab.classList.add("select");
    //             }
    //         }
    //     }
    // });

    // global.test = () => getAllWindows().forEach(win => {
    //     console.log({"id": win.id, "name": win.getTitle()})
    // })
    //
    // global.getFocusedWindow = getFocusedWindowId
    // global.execForWindow = execForWindow
    // global.execForAllWindows = execForAllWindows

    console.log("window_tab.js had been injected");
})();