import {CSSProperties} from "react";


type IStyles = {
    wrapper: CSSProperties,
    button: CSSProperties
}


export const styles: IStyles = ({
    wrapper: {
        display: 'flex',
        flexDirection: 'row',
        gap: "10px"
    },
    button: {
        backgroundImage: 'linear-gradient(92.88deg, #455EB5 9.16%, #5643CC 43.89%, #673FD7 64.72%)',
        borderRadius: '8px',
        borderStyle: 'none',
        boxSizing: 'border-box',
        color: ' #FFFFFF',
        cursor: 'pointer',
        flexShrink: 0,
        fontSize: '16px',
        fontWeight: 500,
        height: '4rem',
        padding: '0 1.6rem',
        textAlign: 'center',
        textShadow: 'rgba(0, 0, 0, 0.25) 0 3px 8px',
        transition: 'all .5s',
    }
})
