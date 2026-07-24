class Solution {
    public int romanToInt(String s) {
        int i = 0;
        int sum = 0;
        int max = s.length();
        while (i < max) {
            if (i >= max) {
                return sum;
            }
            char c= s.charAt(i);
            if (i + 1 < max) { 
                char n = s.charAt(i+1);
                if (c == 'I') {
                    if (n == 'V') {
                        sum+=4;
                        i += 2;
                        continue;
                    } else if (n == 'X') {
                        sum+=9;
                        i += 2;
                        continue;
                    }
                } else if (c == 'X') {
                    if (n == 'L') {
                        sum+=40;
                        i += 2;
                        continue;
                    } else if (n == 'C') {
                        sum+=90;
                        i += 2;
                        continue;
                    }
                } else if (c == 'C') {
                    if (n == 'D') {
                        sum+=400;
                        i += 2;
                        continue;   
                    } else if (n == 'M') {
                        sum+=900;
                        i += 2;
                        continue;
                    }
                }
            }
            
            sum += getIntegerFromRoman(s.charAt(i));
            i++;
        }
        return sum;
    }

    public int getIntegerFromRoman(char c) {
        switch (c) {
            case 'I':
                return 1;
            case 'V':
                return 5;
            case 'X':
                return 10;
            case 'L':
                return 50;
            case 'C':
                return 100;
            case 'D':
                return 500;
            case 'M':
                return 1000;
            default:
                return 0;
        }
    }
}
