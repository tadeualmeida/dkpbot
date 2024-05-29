function generateRandomCode() {
    const digits = '0123456789';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomDigit = () => digits[Math.floor(Math.random() * digits.length)];
    const randomLetter = () => letters[Math.floor(Math.random() * letters.length)];

    // Gera um array de caracteres com duas letras e um número
    const codeArray = [randomLetter(), randomLetter(), randomDigit()];

    // Embaralha o array para garantir que a posição das letras e do número seja aleatória
    for (let i = codeArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [codeArray[i], codeArray[j]] = [codeArray[j], codeArray[i]];
    }

    // Junta os caracteres em uma string
    return codeArray.join('');
}

module.exports = { generateRandomCode };