export function camelCaseString(snakeCase: string | undefined | null): string | undefined | null {
    if (snakeCase) {
        const find = /(\_\w)/g;
        const convert = function (matches: string): string {
            return matches[1].toUpperCase();
        };
        return snakeCase.replace(find, convert);
    }
    return snakeCase;
}
