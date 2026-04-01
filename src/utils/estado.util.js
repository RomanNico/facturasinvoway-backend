export const calcularEstado = (dias) => {
    if (dias <= 1) return "verde";
    if (dias <= 2) return "amarillo";
    return "rojo";
};