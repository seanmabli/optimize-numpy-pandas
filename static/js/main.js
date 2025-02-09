// Initialize theme
const theme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', theme);

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Initialize CodeMirror
var editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
    mode: "python",
    theme: "monokai",
    lineNumbers: true,
    indentUnit: 4,
    autoCloseBrackets: true,
    matchBrackets: true
});

// Add this helper function at the top level
function addCopyButton(container, editor) {
    if (!container) return;  // Guard clause
    
    const header = document.createElement('div');
    header.className = 'code-section-header';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = async () => {
        const code = editor.getValue();
        await navigator.clipboard.writeText(code);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = 'Copy';
        }, 2000);
    };
    
    header.appendChild(copyBtn);
    container.appendChild(header);  // Changed from insertBefore to appendChild
}

// Update the createCodeMirror function
function createCodeMirror(element, code) {
    if (!element) return null;
    
    element.innerHTML = '';
    const editor = CodeMirror(element, {
        value: code || '',
        mode: "python",
        theme: "monokai",
        lineNumbers: true,
        readOnly: true,
        viewportMargin: Infinity,
        scrollbarStyle: "native"
    });
    
    addCopyButton(element, editor);
    return editor;
}

document.getElementById("optimize-btn").addEventListener("click", async () => {
    const code = editor.getValue().trim();
    if (!code) {
        errorContainer.classList.remove("hidden");
        errorContainer.textContent = "Please enter code to optimize";
        return;
    }

    const optimizeBtn = document.getElementById("optimize-btn");
    const resultsContainer = document.getElementById("results-container");
    const errorContainer = document.getElementById("error-container");
    const allResultsContainer = document.getElementById("all-results");

    optimizeBtn.disabled = true;
    optimizeBtn.innerHTML = "Processing...";
    resultsContainer.classList.remove("hidden");
    errorContainer.classList.add("hidden");
    allResultsContainer.innerHTML = "";

    try {
        // Generate and display test cases
        allResultsContainer.innerHTML = "<h3>Generating Test Cases...</h3>";
        const testResponse = await fetch("/generate_tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });

        const testData = await testResponse.json();
        if (!testResponse.ok) throw new Error(testData.error || 'Failed to generate tests');

        // Display test cases section
        allResultsContainer.innerHTML = `
            <div id="test-section">
                <h3>Test Cases</h3>
                ${testData.testCases.map((test, i) => `
                    <div class="variation-container">
                        <h4>Test ${i + 1}</h4>
                        <div class="test-code-container"></div>
                    </div>
                `).join('')}
            </div>
        `;

        // Create CodeMirror instances for test cases
        testData.testCases.forEach((test, i) => {
            const container = document.querySelectorAll('.test-code-container')[i];
            createCodeMirror(container, test);
        });

        // Generate optimizations
        allResultsContainer.innerHTML += "<h3>Generating Optimizations...</h3>";
        const response = await fetch("/optimize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to optimize code');
        }

        const data = await response.json();

        // Evaluate the variations
        const evalResponse = await fetch("/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                variations: data.variations,
                testCases: testData.testCases
            })
        });

        const evalData = await evalResponse.json();
        if (!evalResponse.ok) throw new Error(evalData.error || 'Failed to evaluate code');

        // Add optimization results section while preserving test cases
        const testSection = document.getElementById('test-section');
        const optimizationHtml = `
            <div id="optimization-section">
                <h3>Optimizations</h3>
                ${evalData.results.map((result, index) => `
                    <div class="variation-container">
                        <h4>${index === 0 ? 'Original' : `Optimization ${index}`}</h4>
                        <div class="code-container"></div>
                        ${result.status === 'success' 
                            ? `<p class="success-time">Runtime: ${result.execution_time.toFixed(6)}s</p>
                               <p class="test-results">Tests: ${result.tests_passed}/${result.total_tests}</p>`
                            : `<p class="error-message">Error: ${result.error}</p>`}
                    </div>
                `).join('')}
            </div>
        `;
        allResultsContainer.innerHTML = testSection.outerHTML + optimizationHtml;

        // Create CodeMirror instances for optimization results
        evalData.results.forEach((result, index) => {
            const container = document.querySelectorAll('#optimization-section .variation-container')[index];
            const codeContainer = container.querySelector('.code-container');
            createCodeMirror(codeContainer, result.code);
        });

    } catch (error) {
        errorContainer.classList.remove("hidden");
        errorContainer.textContent = error.message;
    } finally {
        optimizeBtn.disabled = false;
        optimizeBtn.innerHTML = "Optimize Code";
    }
});

// Update the updateVariationsUI function
function updateVariationsUI(variations, currentVariation) {
    const allResultsContainer = document.getElementById("all-results");
    
    allResultsContainer.innerHTML = `
        <h3>Generated Variations:</h3>
        ${variations.map((v, i) => `
            <div class="variation-container">
                <h4>${i === 0 ? 'Original' : `Variation ${i}`}</h4>
                <div class="code-container"></div>
            </div>
        `).join('')}
        ${currentVariation ? `
            <div class="variation-container">
                <h4>Variation ${variations.length}</h4>
                <div class="code-container"></div>
            </div>
        ` : ''}
    `;

    // Create CodeMirror instances for each variation
    variations.forEach((v, i) => {
        const container = allResultsContainer.querySelectorAll('.code-container')[i];
        if (container) {
            container.innerHTML = ''; // Clear existing content
            createCodeMirror(container, v);
        }
    });

    // Create CodeMirror instance for current variation if it exists
    if (currentVariation) {
        const container = allResultsContainer.querySelectorAll('.code-container')[variations.length];
        if (container) {
            container.innerHTML = ''; // Clear existing content
            createCodeMirror(container, currentVariation);
        }
    }
} 