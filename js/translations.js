/**
 * Translations for English and Greek
 */

const TRANSLATIONS = {
    en: {
        // Modal
        'modal.title': 'Family Tree Viewer',
        'modal.description': 'Interactive family tree visualization.',
        'modal.pan': 'Pan:',
        'modal.panDesc': 'Click and drag the background',
        'modal.zoom': 'Zoom:',
        'modal.zoomDesc': 'Use mouse wheel to zoom in/out',
        'modal.details': 'Details:',
        'modal.detailsDesc': 'Hover over a person to see more info',
        'modal.privacy': 'In accordance with UK and EU data protection laws (GDPR), living individuals are not included in this family tree. Only deceased family members are displayed to protect the privacy of living relatives.',
        'modal.corrections': 'If you notice any errors in the family tree, please contact me and I will be happy to make corrections.',
        'modal.fileUpload': 'Click or drop a GEDCOM file here to load your family tree',

        // Tooltip labels
        'tooltip.sex': 'Sex:',
        'tooltip.birth': 'Birth:',
        'tooltip.death': 'Death:',
        'tooltip.nationality': 'Nationality:',
        'tooltip.occupation': 'Occupation:',
        'tooltip.titles': 'Titles:',
        'tooltip.alsoKnown': 'Also:',

        // Sex values
        'sex.male': 'Male',
        'sex.female': 'Female',

        // Misc
        'loading': 'Loading family tree...'
    },
    el: {
        // Modal
        'modal.title': 'Γενεαλογικό Δέντρο',
        'modal.description': 'Διαδραστική απεικόνιση γενεαλογικού δέντρου.',
        'modal.pan': 'Μετακίνηση:',
        'modal.panDesc': 'Κάντε κλικ και σύρετε το φόντο',
        'modal.zoom': 'Ζουμ:',
        'modal.zoomDesc': 'Χρησιμοποιήστε τον τροχό του ποντικιού',
        'modal.details': 'Λεπτομέρειες:',
        'modal.detailsDesc': 'Περάστε το ποντίκι πάνω από ένα άτομο',
        'modal.privacy': 'Σύμφωνα με τους νόμους προστασίας δεδομένων του Ηνωμένου Βασιλείου και της ΕΕ (GDPR), τα εν ζωή άτομα δεν περιλαμβάνονται σε αυτό το γενεαλογικό δέντρο. Εμφανίζονται μόνο αποθανόντα μέλη της οικογένειας.',
        'modal.corrections': 'Αν παρατηρήσετε λάθη στο γενεαλογικό δέντρο, παρακαλώ επικοινωνήστε μαζί μου και θα χαρώ να κάνω διορθώσεις.',
        'modal.fileUpload': 'Κάντε κλικ ή αφήστε ένα αρχείο GEDCOM εδώ',

        // Tooltip labels
        'tooltip.sex': 'Φύλο:',
        'tooltip.birth': 'Γέννηση:',
        'tooltip.death': 'Θάνατος:',
        'tooltip.nationality': 'Εθνικότητα:',
        'tooltip.occupation': 'Επάγγελμα:',
        'tooltip.titles': 'Τίτλοι:',
        'tooltip.alsoKnown': 'Επίσης:',

        // Sex values
        'sex.male': 'Άνδρας',
        'sex.female': 'Γυναίκα',

        // Misc
        'loading': 'Φόρτωση γενεαλογικού δέντρου...'
    }
};

/**
 * i18n helper class
 */
class I18n {
    constructor() {
        this.currentLang = 'en';
    }

    /**
     * Get translation for a key
     */
    t(key) {
        const translations = TRANSLATIONS[this.currentLang];
        return translations[key] || TRANSLATIONS['en'][key] || key;
    }

    /**
     * Set current language
     */
    setLanguage(lang) {
        if (TRANSLATIONS[lang]) {
            this.currentLang = lang;
            this.updatePageTranslations();
            return true;
        }
        return false;
    }

    /**
     * Get current language
     */
    getLanguage() {
        return this.currentLang;
    }

    /**
     * Update all elements with data-i18n attribute
     */
    updatePageTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });
    }

    /**
     * Check if a string contains Greek characters
     */
    static containsGreek(str) {
        if (!str) return false;
        // Greek Unicode range: \u0370-\u03FF (Greek and Coptic) and \u1F00-\u1FFF (Greek Extended)
        return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(str);
    }

    /**
     * Get the appropriate name for the current language
     * If Greek is selected and there's a Greek name available, use it
     * Otherwise fall back to the primary name
     */
    getName(namesArray) {
        if (!namesArray || namesArray.length === 0) {
            return 'Unknown';
        }

        // If English, always use the first name
        if (this.currentLang === 'en') {
            return namesArray[0].full || namesArray[0].given || 'Unknown';
        }

        // For Greek, look for a name with Greek characters
        for (const name of namesArray) {
            if (I18n.containsGreek(name.full) || I18n.containsGreek(name.given)) {
                return name.full || name.given;
            }
        }

        // Fall back to first name if no Greek name found
        return namesArray[0].full || namesArray[0].given || 'Unknown';
    }
}

// Global i18n instance
const i18n = new I18n();
