class Solution {
    public boolean isPalindrome(String s) {
        int n = s.length();

        String str = "";
        for(int i = 0; i < n; i++){
            char c = s.charAt(i);

            if(c >= 'a' && c <= 'z'){
                str += c;
            }

            if(c >= 'A' && c <= 'Z'){
                c = (char) (c + 32);
                str += c;
            }

            if(c >= '0' && c <= '9'){
                str += c;
            }
        }

        for(int i = 0; i < str.length() / 2; i++){
            if(str.charAt(i) != str.charAt(str.length()-1-i)){
                return false;
            }
        }

        return true;
    }
}