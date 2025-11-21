/**
 * Family Tree Visualization
 * Uses D3.js for interactive visualization with zoom and pan
 */

class FamilyTreeVisualization {
    constructor() {
        this.svg = null;
        this.container = null;
        this.zoom = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.nodeElements = null;
        this.linkElements = null;
        this.parser = new GedcomParser();

        this.config = {
            nodeWidth: 140,
            nodeHeight: 50,
            nodeRadius: 12,
            linkDistance: 150,
            chargeStrength: -800,
            collisionRadius: 80
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
        const container = document.getElementById('tree-container');
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
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.container.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Set initial transform to center
        const width = window.innerWidth;
        const height = window.innerHeight - 60;
        const initialTransform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(0.5);
        this.svg.call(this.zoom.transform, initialTransform);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.7);
        });

        document.getElementById('reset-view').addEventListener('click', () => {
            this.resetView();
        });

        // Search functionality
        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', (e) => {
            this.searchNodes(e.target.value);
        });

        // File input
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * Load the default GEDCOM file
     */
    async loadDefaultGedcom() {
        try {
            const response = await fetch('family.ged');
            if (!response.ok) {
                throw new Error('Could not load default GEDCOM file');
            }
            const content = await response.text();
            this.processGedcom(content);
        } catch (error) {
            console.error('Error loading GEDCOM:', error);
            this.hideLoading();
            this.showMessage('Upload a GEDCOM file to view your family tree');
        }
    }

    /**
     * Handle file upload
     */
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

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
            const data = this.parser.parse(content);
            const graphData = this.parser.buildGraphData();

            this.nodes = graphData.nodes;
            this.links = graphData.links;

            this.updateStats();
            this.render();
            this.hideLoading();
        } catch (error) {
            console.error('Error parsing GEDCOM:', error);
            this.hideLoading();
            alert('Error parsing GEDCOM file: ' + error.message);
        }
    }

    /**
     * Render the family tree
     */
    render() {
        // Clear existing elements
        this.container.select('.links').selectAll('*').remove();
        this.container.select('.nodes').selectAll('*').remove();

        if (this.nodes.length === 0) {
            return;
        }

        // Create the force simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(this.config.linkDistance)
                .strength(0.5))
            .force('charge', d3.forceManyBody()
                .strength(this.config.chargeStrength))
            .force('collision', d3.forceCollide()
                .radius(this.config.collisionRadius))
            .force('center', d3.forceCenter(0, 0));

        // Render links
        this.linkElements = this.container.select('.links')
            .selectAll('.link')
            .data(this.links)
            .enter()
            .append('path')
            .attr('class', d => `link ${d.type}`)
            .attr('marker-end', d => d.type === 'parent-child' ? 'url(#arrow)' : null);

        // Add arrow marker for parent-child links
        this.svg.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 60)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', 'rgba(100, 200, 255, 0.25)');

        // Render nodes
        this.nodeElements = this.container.select('.nodes')
            .selectAll('.person-node')
            .data(this.nodes)
            .enter()
            .append('g')
            .attr('class', 'person-node')
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)))
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

        // Update positions on simulation tick
        this.simulation.on('tick', () => this.tick());

        // Run simulation for a bit then stop to improve performance
        this.simulation.alpha(1).restart();
        setTimeout(() => {
            if (this.simulation) {
                this.simulation.alphaTarget(0);
            }
        }, 3000);
    }

    /**
     * Tick function for simulation
     */
    tick() {
        this.linkElements
            .attr('d', d => this.linkPath(d));

        this.nodeElements
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }

    /**
     * Generate curved path for links
     */
    linkPath(d) {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        // Calculate control points for bezier curve
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const dr = Math.sqrt(dx * dx + dy * dy);

        if (d.type === 'marriage') {
            // Straight line for marriage
            return `M${sourceX},${sourceY}L${targetX},${targetY}`;
        } else {
            // Curved line for parent-child
            return `M${sourceX},${sourceY}Q${sourceX},${(sourceY + targetY) / 2} ${targetX},${targetY}`;
        }
    }

    /**
     * Drag handlers
     */
    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
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

        // Show additional names if available
        if (data.names && data.names.length > 1) {
            const altNames = data.names.slice(1).map(n => n.full).join(', ');
            html += `<div class="tooltip-row">
                <span class="tooltip-label">Also:</span>
                <span class="tooltip-value">${altNames}</span>
            </div>`;
        }

        tooltip.innerHTML = html;

        // Position tooltip
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
     * Search nodes by name
     */
    searchNodes(query) {
        if (!this.nodeElements) return;

        const lowerQuery = query.toLowerCase().trim();

        this.nodeElements.each(function(d) {
            const node = d3.select(this);
            const matches = !lowerQuery || d.name.toLowerCase().includes(lowerQuery);

            node.select('.person-card')
                .style('opacity', matches ? 1 : 0.2);
            node.select('.person-name')
                .style('opacity', matches ? 1 : 0.2);
            node.select('.person-dates')
                .style('opacity', matches ? 1 : 0.2);
        });

        // Highlight and focus on first match
        if (lowerQuery) {
            const match = this.nodes.find(n => n.name.toLowerCase().includes(lowerQuery));
            if (match) {
                this.focusOnNode(match, false);
            }
        }
    }

    /**
     * Focus on a specific node
     */
    focusOnNode(d, animate = true) {
        const width = window.innerWidth;
        const height = window.innerHeight - 60;

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
     * Reset view to center
     */
    resetView() {
        const width = window.innerWidth;
        const height = window.innerHeight - 60;

        const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(0.5);

        this.svg.transition()
            .duration(500)
            .call(this.zoom.transform, transform);

        // Clear search
        document.getElementById('search').value = '';
        this.searchNodes('');
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Update any size-dependent elements
    }

    /**
     * Update statistics display
     */
    updateStats() {
        const stats = document.getElementById('stats');
        stats.textContent = `${this.nodes.length} individuals | ${this.links.length} connections`;
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    /**
     * Show a message to the user
     */
    showMessage(message) {
        const stats = document.getElementById('stats');
        stats.textContent = message;
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
