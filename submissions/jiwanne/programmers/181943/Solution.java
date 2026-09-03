class Solution {
    public String solution(String my_string, String overwrite_string, int s) {
        String answer = "";
        char[] my_chars = my_string.toCharArray();
        char[] overwrite_chars = overwrite_string.toCharArray();
        
        for(int i = 0; i<overwrite_chars.length; i++) {
            my_chars[s + i] = overwrite_chars[i];
        }
        return String.valueOf(my_chars);
    }
}