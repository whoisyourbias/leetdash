class Solution {
    public int myAtoi(String s) {
        int i = 0;
        int result = 0;
        int plma = 1;
        while (i <= s.length()-1 &&Character.isWhitespace(s.charAt(i))) {
            i++;
        }

        if (i <= s.length()-1 && s.charAt(i) == '-') {
            plma = -1;
            i++;
        } else if (i <= s.length()-1 && s.charAt(i) == '+') {
            plma = 1;
            i++;
        }

        while (i <= s.length()-1 && Character.isDigit(s.charAt(i))) {
            int digit = s.charAt(i) - '0';

            if (result > Integer.MAX_VALUE / 10 || (result == Integer.MAX_VALUE / 10 && digit > 7)){
                return (plma == 1) ? Integer.MAX_VALUE : Integer.MIN_VALUE;
            }
            result = result * 10 + digit;
            i++;
        }

        return result * plma;
    }
}