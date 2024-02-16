import {useRouter} from 'next/router';
import {Languages} from "@/lib/constants";
import {styles} from './language-switcher.style'

const LanguageSwitcher = () => {
    const router = useRouter();

    const handleChangeLanguage = (language: string) => {
        router.push(router.pathname, router.asPath, {locale: language});
    };

    return (
        <div style={styles.wrapper}>
            <button style={styles.button} onClick={() => handleChangeLanguage(Languages.EN)}>English</button>
            <button style={styles.button} onClick={() => handleChangeLanguage(Languages.DE)}>German</button>
            <button style={styles.button} onClick={() => handleChangeLanguage(Languages.FR)}>French</button>
        </div>
    );
};

export default LanguageSwitcher;
