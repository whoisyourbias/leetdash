class Solution {
    public int firstUniqChar(String s) {
        int[] fre = new int[26];

        for(int i = 0; i < s.length(); i++) {
            fre[s.charAt(i) - 'a']++;
        }

        for(int i = 0; i < s.length(); i++) {
            if (fre[s.charAt(i) - 'a'] == 1) {
                return i;
            }
        }
        return -1;  
    }
}