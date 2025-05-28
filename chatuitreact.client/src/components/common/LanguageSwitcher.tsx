import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher">
      <button
        onClick={() => changeLanguage('en')}
        className={`language-btn ${i18n.language === 'en' ? 'active' : ''}`}
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('no')}
        className={`language-btn ${i18n.language === 'no' ? 'active' : ''}`}
      >
        NO
      </button>
    </div>
  );
};

export default LanguageSwitcher;
