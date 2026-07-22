class Solution {
    public void reverseString(char[] s) {
        int write = 0; 
        for (int i = s.length - 1; i > write; i--){
            char tmp = s[i]; 
            s[i] = s[write]; 
            s[write] = tmp; 
            write++; 
        }
    }
}