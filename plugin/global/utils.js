(() => {
    const insertStyle = (id, css) => {
        const style = document.createElement('style');
        style.id = id;
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    }

    const getPlugin = fixed_name => {
        const idx = global._plugins.findIndex(plugin => plugin.enable && plugin.fixed_name === fixed_name)
        if (idx !== -1) {
            return global._plugins[idx];
        }
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;
    const getDirname = () => global.dirname || global.__dirname;
    const getFilePath = () => File.filePath || File.bundle && File.bundle.filePath;
    const joinPath = (...paths) => Package.Path.join(getDirname(), ...paths);

    const requireFile = (...paths) => {
        const filepath = joinPath(...paths);
        return reqnode(filepath)
    }

    const Package = {
        Path: reqnode("path"),
        Fs: reqnode("fs"),
        ChildProcess: reqnode('child_process'),
    };

    const detectorContainer = {}

    const decorate = (until, obj, func, before, after, changeResult = false) => {
        const uuid = Math.random();
        detectorContainer[uuid] = setInterval(() => {
            if (!until()) return;

            const decorator = (original, before, after) => {
                return function () {
                    if (before) {
                        before.call(this, ...arguments);
                    }

                    let result = original.apply(this, arguments);

                    if (after) {
                        const afterResult = after.call(this, result, ...arguments);
                        if (changeResult) {
                            result = afterResult;
                        }
                    }
                    return result;
                };
            }
            obj[func] = decorator(obj[func], before, after);
            clearInterval(detectorContainer[uuid]);
            delete detectorContainer[uuid];
        }, 20);
    }

    const decorateOpenFile = (before, after) => {
        decorate(() => !!File, File.editor.library, "openFile", before, after)
    }

    const decorateAddCodeBlock = (before, after) => {
        decorate(() => !!File, File.editor.fences, "addCodeBlock", before, after)
    }

    const dragFixedModal = (handleElement, moveElement, withMetaKey = true) => {
        handleElement.addEventListener("mousedown", ev => {
            if (withMetaKey && !metaKeyPressed(ev) || ev.button !== 0) return;
            ev.stopPropagation();
            const rect = moveElement.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                if (withMetaKey && !metaKeyPressed(ev) || ev.button !== 0) return;
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    moveElement.style.left = ev.clientX - shiftX + 'px';
                    moveElement.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    if (withMetaKey && !metaKeyPressed(ev) || ev.button !== 0) return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    moveElement.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        handleElement.ondragstart = () => false
    }

    module.exports = {
        insertStyle,
        getPlugin,
        metaKeyPressed,
        getDirname,
        getFilePath,
        joinPath,
        requireFile,
        Package,
        decorate,
        decorateOpenFile,
        decorateAddCodeBlock,
        dragFixedModal,
    };
})()