import "./viewRouter";

(function() {
    const vsCodeApi = acquireVsCodeApi(); 

    document.addEventListener("click", (e) => {
        const toggle = document.getElementById("dropdownButton");
        const menu = document.getElementById("dropdownMenu");

        if (toggle.contains(e.target)) {
            menu.classList.toggle("hidden");
        } else if (!menu.contains(e.target)) {
            menu.classList.add("hidden");
        }
        });
        
        // Notify the extension that the webview is ready
        vsCodeApi.postMessage({ command: 'webviewReady' }); 

    
})();