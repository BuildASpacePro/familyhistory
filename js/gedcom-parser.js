/**
 * GEDCOM Parser
 * Parses GEDCOM 5.5.1 format files into JavaScript objects
 */

class GedcomParser {
    constructor() {
        this.individuals = new Map();
        this.families = new Map();
        this.header = {};
    }

    /**
     * Parse a GEDCOM file content string
     * @param {string} content - The GEDCOM file content
     * @returns {Object} Parsed data with individuals and families
     */
    parse(content) {
        const lines = content.split(/\r?\n/);
        let currentRecord = null;
        let currentLevel = 0;
        let stack = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parsed = this.parseLine(line);
            if (!parsed) continue;

            const { level, xref, tag, value } = parsed;

            // Level 0 records start new entities
            if (level === 0) {
                this.saveCurrentRecord(currentRecord);

                if (xref && tag === 'INDI') {
                    currentRecord = {
                        type: 'INDI',
                        id: xref,
                        names: [],
                        sex: '',
                        birth: null,
                        death: null,
                        occupation: '',
                        nationality: '',
                        titles: [],
                        notes: [],
                        familyChild: null,
                        familySpouse: []
                    };
                } else if (xref && tag === 'FAM') {
                    currentRecord = {
                        type: 'FAM',
                        id: xref,
                        husband: null,
                        wife: null,
                        children: [],
                        marriage: null,
                        divorce: null
                    };
                } else if (tag === 'HEAD') {
                    currentRecord = { type: 'HEAD' };
                } else {
                    currentRecord = null;
                }
                stack = [{ level: 0, tag, record: currentRecord }];
            } else if (currentRecord) {
                // Process subordinate lines
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                const parent = stack.length > 0 ? stack[stack.length - 1] : null;
                this.processTag(currentRecord, level, tag, value, parent);
                stack.push({ level, tag, value, record: currentRecord });
            }
        }

        // Save the last record
        this.saveCurrentRecord(currentRecord);

        return {
            individuals: this.individuals,
            families: this.families,
            header: this.header
        };
    }

    /**
     * Parse a single GEDCOM line
     */
    parseLine(line) {
        // GEDCOM line format: LEVEL [XREF] TAG [VALUE]
        // Example: 0 @I1@ INDI
        // Example: 1 NAME John /Doe/
        const match = line.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
        if (!match) return null;

        return {
            level: parseInt(match[1], 10),
            xref: match[2] || null,
            tag: match[3],
            value: match[4] || ''
        };
    }

    /**
     * Process a tag and add data to the current record
     */
    processTag(record, level, tag, value, parent) {
        if (record.type === 'INDI') {
            this.processIndividualTag(record, level, tag, value, parent);
        } else if (record.type === 'FAM') {
            this.processFamilyTag(record, level, tag, value, parent);
        }
    }

    /**
     * Process tags for INDI records
     */
    processIndividualTag(record, level, tag, value, parent) {
        const parentTag = parent ? parent.tag : null;

        switch (tag) {
            case 'NAME':
                record.names.push(this.parseName(value));
                break;
            case 'SEX':
                record.sex = value;
                break;
            case 'BIRT':
                record.birth = { date: '', place: '', type: '' };
                break;
            case 'DEAT':
                record.death = { date: '', place: '', type: '' };
                break;
            case 'DATE':
                if (parentTag === 'BIRT' && record.birth) {
                    record.birth.date = value;
                } else if (parentTag === 'DEAT' && record.death) {
                    record.death.date = value;
                }
                break;
            case 'PLAC':
                if (parentTag === 'BIRT' && record.birth) {
                    record.birth.place = value;
                } else if (parentTag === 'DEAT' && record.death) {
                    record.death.place = value;
                }
                break;
            case 'TYPE':
                if (parentTag === 'BIRT' && record.birth) {
                    record.birth.type = value;
                } else if (parentTag === 'DEAT' && record.death) {
                    record.death.type = value;
                }
                break;
            case 'OCCU':
                record.occupation = value;
                break;
            case 'NATI':
                record.nationality = value;
                break;
            case 'TITL':
                record.titles.push(value);
                break;
            case 'NOTE':
                record.notes.push(value);
                break;
            case 'FAMC':
                record.familyChild = value;
                break;
            case 'FAMS':
                record.familySpouse.push(value);
                break;
        }
    }

    /**
     * Process tags for FAM records
     */
    processFamilyTag(record, level, tag, value, parent) {
        const parentTag = parent ? parent.tag : null;

        switch (tag) {
            case 'HUSB':
                record.husband = value;
                break;
            case 'WIFE':
                record.wife = value;
                break;
            case 'CHIL':
                record.children.push(value);
                break;
            case 'MARR':
                record.marriage = { date: '', place: '' };
                break;
            case 'DIV':
                record.divorce = { date: '', place: '' };
                break;
            case 'DATE':
                if (parentTag === 'MARR' && record.marriage) {
                    record.marriage.date = value;
                } else if (parentTag === 'DIV' && record.divorce) {
                    record.divorce.date = value;
                }
                break;
            case 'PLAC':
                if (parentTag === 'MARR' && record.marriage) {
                    record.marriage.place = value;
                } else if (parentTag === 'DIV' && record.divorce) {
                    record.divorce.place = value;
                }
                break;
        }
    }

    /**
     * Parse a GEDCOM name string
     * Format: Given /Surname/ or just Given
     */
    parseName(nameStr) {
        const match = nameStr.match(/^([^\/]*)\/?([^\/]*)\/?(.*)$/);
        if (match) {
            const given = match[1].trim();
            const surname = match[2].trim();
            const suffix = match[3].trim();
            return {
                full: nameStr.replace(/\//g, '').trim(),
                given: given,
                surname: surname,
                suffix: suffix
            };
        }
        return {
            full: nameStr.trim(),
            given: nameStr.trim(),
            surname: '',
            suffix: ''
        };
    }

    /**
     * Save the current record to the appropriate collection
     */
    saveCurrentRecord(record) {
        if (!record) return;

        if (record.type === 'INDI') {
            this.individuals.set(record.id, record);
        } else if (record.type === 'FAM') {
            this.families.set(record.id, record);
        } else if (record.type === 'HEAD') {
            this.header = record;
        }
    }

    /**
     * Get the display name for an individual
     */
    getDisplayName(individual) {
        if (!individual || !individual.names || individual.names.length === 0) {
            return 'Unknown';
        }
        const name = individual.names[0];
        return name.full || name.given || 'Unknown';
    }

    /**
     * Get formatted birth/death dates
     */
    getLifespan(individual) {
        if (!individual) return '';

        const birth = individual.birth?.date || '';
        const death = individual.death?.date || '';

        if (birth || death) {
            return `${birth || '?'} - ${death || ''}`;
        }
        return '';
    }

    /**
     * Build relationship graph data for visualization
     */
    buildGraphData() {
        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        // Create nodes for all individuals
        this.individuals.forEach((individual, id) => {
            const node = {
                id: id,
                name: this.getDisplayName(individual),
                sex: individual.sex,
                birth: individual.birth,
                death: individual.death,
                lifespan: this.getLifespan(individual),
                nationality: individual.nationality,
                titles: individual.titles,
                occupation: individual.occupation,
                data: individual
            };
            nodes.push(node);
            nodeMap.set(id, node);
        });

        // Create links from families
        this.families.forEach((family, famId) => {
            const husband = family.husband ? nodeMap.get(family.husband) : null;
            const wife = family.wife ? nodeMap.get(family.wife) : null;

            // Marriage link between spouses
            if (husband && wife) {
                links.push({
                    source: husband.id,
                    target: wife.id,
                    type: 'marriage',
                    familyId: famId
                });
            }

            // Parent-child links
            family.children.forEach(childId => {
                const child = nodeMap.get(childId);
                if (child) {
                    // Link from father to child
                    if (husband) {
                        links.push({
                            source: husband.id,
                            target: childId,
                            type: 'parent-child',
                            familyId: famId
                        });
                    }
                    // Link from mother to child
                    if (wife) {
                        links.push({
                            source: wife.id,
                            target: childId,
                            type: 'parent-child',
                            familyId: famId
                        });
                    }
                }
            });
        });

        return { nodes, links };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GedcomParser;
}
