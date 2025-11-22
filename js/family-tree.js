/**
 * Family Tree Visualization
 * Hierarchical layout with generations in rows
 */

class FamilyTreeVisualization {
    constructor() {
        this.svg = null;
        this.container = null;
        this.zoom = null;
        this.nodes = [];
        this.links = [];
        this.nodeElements = null;
        this.linkElements = null;
        this.parser = new GedcomParser();
        this.generations = new Map(); // Maps person ID to generation number

        this.config = {
            nodeWidth: 140,
            nodeHeight: 50,
            nodeRadius: 12,
            horizontalSpacing: 160,  // Space between nodes horizontally
            verticalSpacing: 120,    // Space between generations
            familyGap: 40            // Extra gap between family groups
        };

        this.init();
    }

    /**
     * Initialize the visualization
     */
    init() {
        this.setupSVG();
        this.setupZoom();
        this.setupEventListeners();
        this.loadDefaultGedcom();
    }

    /**
     * Setup the SVG element
     */
    setupSVG() {
        this.svg = d3.select('#tree-svg');

        // Create a group for zoom/pan transformations
        this.container = this.svg.append('g')
            .attr('class', 'tree-content');

        // Create groups for links and nodes (links should be behind nodes)
        this.container.append('g').attr('class', 'links');
        this.container.append('g').attr('class', 'nodes');
    }

    /**
     * Setup zoom behavior
     */
    setupZoom() {
        this.zoom = d3.zoom()
            .scaleExtent([0.05, 4])
            .on('zoom', (event) => {
                this.container.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Set initial transform to center
        const width = window.innerWidth;
        const height = window.innerHeight;
        const initialTransform = d3.zoomIdentity
            .translate(width / 2, 100)
            .scale(0.3);
        this.svg.call(this.zoom.transform, initialTransform);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Info modal
        const infoBtn = document.getElementById('info-btn');
        const infoModal = document.getElementById('info-modal');
        const modalClose = document.getElementById('modal-close');

        if (infoBtn) {
            infoBtn.addEventListener('click', () => {
                infoModal.classList.add('visible');
            });
        }

        if (modalClose) {
            modalClose.addEventListener('click', () => {
                infoModal.classList.remove('visible');
            });
        }

        if (infoModal) {
            infoModal.addEventListener('click', (e) => {
                if (e.target === infoModal) {
                    infoModal.classList.remove('visible');
                }
            });
        }

        // File input
        const fileInput = document.getElementById('file-input');
        const fileDropZone = document.getElementById('file-drop-zone');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e);
                infoModal.classList.remove('visible');
            });
        }

        if (fileDropZone) {
            fileDropZone.addEventListener('click', () => {
                fileInput.click();
            });

            fileDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileDropZone.classList.add('dragover');
            });

            fileDropZone.addEventListener('dragleave', () => {
                fileDropZone.classList.remove('dragover');
            });

            fileDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                fileDropZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) {
                    this.handleFileFromDrop(file);
                    infoModal.classList.remove('visible');
                }
            });
        }

        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const infoModal = document.getElementById('info-modal');
                infoModal.classList.remove('visible');
            }
            if (e.key === 'r' || e.key === 'R') {
                this.resetView();
            }
        });
    }

    /**
     * Load the default GEDCOM from embedded data
     */
    loadDefaultGedcom() {
        if (typeof GEDCOM_DATA !== 'undefined' && GEDCOM_DATA) {
            this.processGedcom(GEDCOM_DATA);
        } else {
            this.fetchGedcomFile();
        }
    }

    /**
     * Fetch GEDCOM file (fallback for web server)
     */
    async fetchGedcomFile() {
        try {
            const response = await fetch('family.ged');
            if (!response.ok) {
                throw new Error('Could not load GEDCOM file');
            }
            const content = await response.text();
            this.processGedcom(content);
        } catch (error) {
            console.log('No default GEDCOM loaded. Use the info button to upload a file.');
            this.hideLoading();
        }
    }

    /**
     * Handle file upload from input
     */
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.handleFileFromDrop(file);
    }

    /**
     * Handle file from drop or input
     */
    handleFileFromDrop(file) {
        this.showLoading();

        const reader = new FileReader();
        reader.onload = (e) => {
            this.processGedcom(e.target.result);
        };
        reader.onerror = () => {
            this.hideLoading();
            alert('Error reading file');
        };
        reader.readAsText(file);
    }

    /**
     * Process GEDCOM content and render the tree
     */
    processGedcom(content) {
        try {
            this.parser = new GedcomParser();
            const data = this.parser.parse(content);
            const graphData = this.parser.buildGraphData();

            this.nodes = graphData.nodes;
            this.links = graphData.links;

            // Calculate generations and positions
            this.calculateGenerations();
            this.calculatePositions();

            this.render();
            this.hideLoading();
        } catch (error) {
            console.error('Error parsing GEDCOM:', error);
            this.hideLoading();
            alert('Error parsing GEDCOM file: ' + error.message);
        }
    }

    /**
     * Calculate generation numbers for each person
     * Uses birth dates when available, falls back to family relationships
     */
    calculateGenerations() {
        this.generations.clear();

        // Build parent-child relationship maps
        const childToParents = new Map();
        const parentToChildren = new Map();

        this.links.forEach(link => {
            if (link.type === 'parent-child') {
                const parentId = link.source.id || link.source;
                const childId = link.target.id || link.target;

                if (!childToParents.has(childId)) {
                    childToParents.set(childId, []);
                }
                childToParents.get(childId).push(parentId);

                if (!parentToChildren.has(parentId)) {
                    parentToChildren.set(parentId, []);
                }
                parentToChildren.get(parentId).push(childId);
            }
        });

        // Find root ancestors (people with no parents in the data)
        const roots = this.nodes.filter(node => !childToParents.has(node.id));

        // BFS from roots to assign generations
        const queue = [];
        roots.forEach(root => {
            this.generations.set(root.id, 0);
            queue.push(root.id);
        });

        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentGen = this.generations.get(currentId);

            const children = parentToChildren.get(currentId) || [];
            children.forEach(childId => {
                if (!this.generations.has(childId)) {
                    this.generations.set(childId, currentGen + 1);
                    queue.push(childId);
                } else {
                    // Update to deeper generation if needed
                    const existingGen = this.generations.get(childId);
                    if (currentGen + 1 > existingGen) {
                        this.generations.set(childId, currentGen + 1);
                        queue.push(childId);
                    }
                }
            });
        }

        // Handle disconnected nodes (people not connected to any tree)
        this.nodes.forEach(node => {
            if (!this.generations.has(node.id)) {
                // Try to estimate from birth year if available
                const birthYear = this.extractYear(node.birth?.date);
                if (birthYear) {
                    // Rough estimate: generation = (birthYear - 1000) / 25
                    const estimatedGen = Math.floor((birthYear - 1000) / 30);
                    this.generations.set(node.id, Math.max(0, estimatedGen));
                } else {
                    this.generations.set(node.id, 0);
                }
            }
        });

        // Normalize generations to start from 0
        let minGen = Infinity;
        this.generations.forEach(gen => {
            if (gen < minGen) minGen = gen;
        });
        if (minGen !== 0 && minGen !== Infinity) {
            this.generations.forEach((gen, id) => {
                this.generations.set(id, gen - minGen);
            });
        }
    }

    /**
     * Extract year from a date string
     */
    extractYear(dateStr) {
        if (!dateStr) return null;
        const match = dateStr.match(/\b(\d{3,4})\b/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Calculate x,y positions for all nodes
     */
    calculatePositions() {
        // Group nodes by generation
        const generationGroups = new Map();

        this.nodes.forEach(node => {
            const gen = this.generations.get(node.id) || 0;
            if (!generationGroups.has(gen)) {
                generationGroups.set(gen, []);
            }
            generationGroups.get(gen).push(node);
        });

        // Sort generations
        const sortedGens = Array.from(generationGroups.keys()).sort((a, b) => a - b);

        // Build spouse pairs for better positioning
        const spousePairs = new Map();
        this.links.forEach(link => {
            if (link.type === 'marriage') {
                const id1 = link.source.id || link.source;
                const id2 = link.target.id || link.target;
                spousePairs.set(id1, id2);
                spousePairs.set(id2, id1);
            }
        });

        // Position each generation
        sortedGens.forEach((gen, genIndex) => {
            const nodesInGen = generationGroups.get(gen);

            // Sort nodes within generation to keep spouses together
            nodesInGen.sort((a, b) => {
                const aSpouse = spousePairs.get(a.id);
                const bSpouse = spousePairs.get(b.id);

                // Keep spouses adjacent
                if (aSpouse === b.id) return -1;
                if (bSpouse === a.id) return 1;

                // Otherwise sort by name for consistency
                return a.name.localeCompare(b.name);
            });

            // Calculate y position (generation row)
            const y = genIndex * this.config.verticalSpacing;

            // Calculate x positions
            const totalWidth = nodesInGen.length * this.config.horizontalSpacing;
            const startX = -totalWidth / 2;

            nodesInGen.forEach((node, i) => {
                node.x = startX + (i + 0.5) * this.config.horizontalSpacing;
                node.y = y;
                node.generation = gen;
            });
        });

        // Second pass: try to center children under parents
        this.optimizePositions(generationGroups, sortedGens);
    }

    /**
     * Optimize positions to reduce link crossings and center children under parents
     */
    optimizePositions(generationGroups, sortedGens) {
        // Build parent-child map
        const parentToChildren = new Map();
        this.links.forEach(link => {
            if (link.type === 'parent-child') {
                const parentId = link.source.id || link.source;
                const childId = link.target.id || link.target;
                if (!parentToChildren.has(parentId)) {
                    parentToChildren.set(parentId, []);
                }
                parentToChildren.get(parentId).push(childId);
            }
        });

        // Create node lookup
        const nodeById = new Map();
        this.nodes.forEach(node => nodeById.set(node.id, node));

        // Multiple passes to optimize
        for (let pass = 0; pass < 3; pass++) {
            // Position children centered under parents
            sortedGens.forEach(gen => {
                const nodesInGen = generationGroups.get(gen);

                nodesInGen.forEach(node => {
                    const children = parentToChildren.get(node.id) || [];
                    if (children.length > 0) {
                        const childNodes = children.map(id => nodeById.get(id)).filter(n => n);
                        if (childNodes.length > 0) {
                            // Calculate average x of children
                            const avgChildX = childNodes.reduce((sum, c) => sum + c.x, 0) / childNodes.length;
                            // Move parent toward children's center (partial adjustment)
                            node.x = node.x * 0.3 + avgChildX * 0.7;
                        }
                    }
                });
            });

            // Prevent overlaps within each generation
            sortedGens.forEach(gen => {
                const nodesInGen = generationGroups.get(gen);
                nodesInGen.sort((a, b) => a.x - b.x);

                for (let i = 1; i < nodesInGen.length; i++) {
                    const prev = nodesInGen[i - 1];
                    const curr = nodesInGen[i];
                    const minDist = this.config.horizontalSpacing;

                    if (curr.x - prev.x < minDist) {
                        curr.x = prev.x + minDist;
                    }
                }
            });
        }

        // Center the tree horizontally
        let minX = Infinity, maxX = -Infinity;
        this.nodes.forEach(node => {
            if (node.x < minX) minX = node.x;
            if (node.x > maxX) maxX = node.x;
        });
        const centerOffset = (minX + maxX) / 2;
        this.nodes.forEach(node => {
            node.x -= centerOffset;
        });
    }

    /**
     * Render the family tree
     */
    render() {
        // Clear existing elements
        this.container.select('.links').selectAll('*').remove();
        this.container.select('.nodes').selectAll('*').remove();
        this.svg.selectAll('defs').remove();

        if (this.nodes.length === 0) {
            return;
        }

        // Create node lookup for links
        const nodeById = new Map();
        this.nodes.forEach(node => nodeById.set(node.id, node));

        // Update links with actual node references
        this.links.forEach(link => {
            if (typeof link.source === 'string') {
                link.source = nodeById.get(link.source);
            }
            if (typeof link.target === 'string') {
                link.target = nodeById.get(link.target);
            }
        });

        // Filter out links with missing nodes
        const validLinks = this.links.filter(link => link.source && link.target);

        // Render links
        this.linkElements = this.container.select('.links')
            .selectAll('.link')
            .data(validLinks)
            .enter()
            .append('path')
            .attr('class', d => `link ${d.type}`)
            .attr('d', d => this.linkPath(d));

        // Render nodes
        this.nodeElements = this.container.select('.nodes')
            .selectAll('.person-node')
            .data(this.nodes)
            .enter()
            .append('g')
            .attr('class', 'person-node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .on('mouseenter', (event, d) => this.showTooltip(event, d))
            .on('mouseleave', () => this.hideTooltip())
            .on('click', (event, d) => this.focusOnNode(d));

        // Add card background
        this.nodeElements.append('rect')
            .attr('class', d => `person-card ${d.sex === 'M' ? 'male' : d.sex === 'F' ? 'female' : ''}`)
            .attr('width', this.config.nodeWidth)
            .attr('height', this.config.nodeHeight)
            .attr('x', -this.config.nodeWidth / 2)
            .attr('y', -this.config.nodeHeight / 2)
            .attr('rx', this.config.nodeRadius)
            .attr('ry', this.config.nodeRadius);

        // Add name text
        this.nodeElements.append('text')
            .attr('class', 'person-name')
            .attr('dy', d => d.lifespan ? -4 : 4)
            .text(d => this.truncateName(d.name, 18));

        // Add lifespan text
        this.nodeElements.append('text')
            .attr('class', 'person-dates')
            .attr('dy', 12)
            .text(d => d.lifespan ? this.truncateName(d.lifespan, 20) : '');
    }

    /**
     * Generate path for links
     */
    linkPath(d) {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        if (d.type === 'marriage') {
            // Straight horizontal line for marriage (spouses on same level)
            return `M${sourceX},${sourceY}L${targetX},${targetY}`;
        } else {
            // Curved line for parent-child (vertical relationship)
            const midY = (sourceY + targetY) / 2;
            return `M${sourceX},${sourceY + this.config.nodeHeight / 2}
                    C${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY - this.config.nodeHeight / 2}`;
        }
    }

    /**
     * Show tooltip on hover
     */
    showTooltip(event, d) {
        const tooltip = document.getElementById('tooltip');
        const data = d.data;

        let html = `<h3>${d.name}</h3>`;

        if (d.sex) {
            const sexLabel = d.sex === 'M' ? 'Male' : d.sex === 'F' ? 'Female' : d.sex;
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Sex:</span>
                <span class="tooltip-value ${d.sex === 'M' ? 'male' : 'female'}">${sexLabel}</span>
            </div>`;
        }

        if (d.birth?.date) {
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Birth:</span>
                <span class="tooltip-value">${d.birth.date}${d.birth.place ? ' in ' + d.birth.place : ''}</span>
            </div>`;
        }

        if (d.death?.date) {
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Death:</span>
                <span class="tooltip-value">${d.death.date}${d.death.place ? ' in ' + d.death.place : ''}</span>
            </div>`;
        }

        if (d.nationality) {
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Nationality:</span>
                <span class="tooltip-value">${d.nationality}</span>
            </div>`;
        }

        if (d.occupation) {
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Occupation:</span>
                <span class="tooltip-value">${d.occupation}</span>
            </div>`;
        }

        if (d.titles && d.titles.length > 0) {
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Titles:</span>
                <span class="tooltip-value">${d.titles.join(', ')}</span>
            </div>`;
        }

        if (data.names && data.names.length > 1) {
            const altNames = data.names.slice(1).map(n => n.full).join(', ');
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Also:</span>
                <span class="tooltip-value">${altNames}</span>
            </div>`;
        }

        tooltip.innerHTML = html;

        const x = event.pageX + 15;
        const y = event.pageY + 15;

        tooltip.style.left = `${Math.min(x, window.innerWidth - 320)}px`;
        tooltip.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
        tooltip.classList.add('visible');
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.classList.remove('visible');
    }

    /**
     * Focus on a specific node
     */
    focusOnNode(d, animate = true) {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const transform = d3.zoomIdentity
            .translate(width / 2 - d.x, height / 2 - d.y)
            .scale(1);

        if (animate) {
            this.svg.transition()
                .duration(500)
                .call(this.zoom.transform, transform);
        }
    }

    /**
     * Reset view to show full tree
     */
    resetView() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Calculate bounds of tree
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        this.nodes.forEach(node => {
            if (node.x < minX) minX = node.x;
            if (node.x > maxX) maxX = node.x;
            if (node.y < minY) minY = node.y;
            if (node.y > maxY) maxY = node.y;
        });

        const treeWidth = maxX - minX + this.config.nodeWidth * 2;
        const treeHeight = maxY - minY + this.config.nodeHeight * 2;

        const scale = Math.min(
            width / treeWidth * 0.9,
            height / treeHeight * 0.9,
            1
        );

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const transform = d3.zoomIdentity
            .translate(width / 2 - centerX * scale, height / 2 - centerY * scale)
            .scale(scale);

        this.svg.transition()
            .duration(500)
            .call(this.zoom.transform, transform);
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Could trigger resetView or adjust positions
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * Truncate name if too long
     */
    truncateName(name, maxLength) {
        if (!name) return '';
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength - 2) + '...';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.familyTree = new FamilyTreeVisualization();
});
