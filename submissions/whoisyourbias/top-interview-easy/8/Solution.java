class Solution {

    static int i;

    public int myAtoi(String s) {
        int rtn = 0;

        i = 0;

        //remove leading whitespace
        while (i < s.length() && Character.isSpaceChar(s.charAt(i))) {
            i++;
        }

        int sign = 1;

		if (i < s.length()) {
            if (s.charAt(i) == '-') {
    			sign = -1;
                i++;
            } else if (s.charAt(i) == '+') {
                i++;
            }
		}

        while (i < s.length() && s.charAt(i) == '0') {i++;}

        while (i < s.length() && Character.isDigit(s.charAt(i))) {
            int v = s.charAt(i) - '0';
            i++;

            if (rtn != 0 && sign == -1) {
                    // -214748365 < -2147483648 / 10
                if (rtn * sign < Integer.MIN_VALUE / 10) {
                    
                    return Integer.MIN_VALUE;
                }
                    // -2147483640 < -2147483648 + 9
                if (rtn * sign * 10 < Integer.MIN_VALUE + v) {
                    
                    return Integer.MIN_VALUE;
                }
            } else {
                // 214748365 > 214748364
                if (rtn > Integer.MAX_VALUE / 10) {
                    return Integer.MAX_VALUE;
                }
                // 2147483640 > 2147483647 - 8 
                if (rtn * 10 > Integer.MAX_VALUE - v) {
                    return Integer.MAX_VALUE;
                }
            }

            rtn = rtn * 10 + v;
        }

		return rtn * sign;
	}
}
