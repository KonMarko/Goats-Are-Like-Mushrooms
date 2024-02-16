import {CSSProperties} from "react";


type IStyles = {
    wrapper: CSSProperties,
}


export const styles: IStyles = ({
    wrapper: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '30px',
        alignItems: 'center',
        padding: '6rem',
        minHeight: '100vh'
    },
})
