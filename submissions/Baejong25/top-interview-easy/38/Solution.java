class Solution {
    public String countAndSay(int n) {
        if (n == 1) {
            return "1";
        } else {
            String ele = countAndSay(n-1);
            int cnt = 1;
            String result = "";
            for(int i = 0; i < ele.length(); i++) {
                if (i != ele.length()-1 && ele.charAt(i) == ele.charAt(i+1)) {
                    cnt++;
                } else if (i != ele.length()-1 && ele.charAt(i) != ele.charAt(i+1)) {
                    result += String.valueOf(cnt);
                    result += String.valueOf(ele.charAt(i));
                    cnt = 1;
                } else if (i == ele.length()-1) {
                    if (i == 0) {
                        result += "1";
                        result += String.valueOf(ele.charAt(i));
                    } else if (ele.charAt(i) == ele.charAt(i-1)) {
                        result += String.valueOf(cnt);
                        result += String.valueOf(ele.charAt(i));
                    } else if (ele.charAt(i) != ele.charAt(i-1)){
                        result += "1";
                        result += String.valueOf(ele.charAt(i));
                    }
                }
            }
            return result;
        }
    }
}