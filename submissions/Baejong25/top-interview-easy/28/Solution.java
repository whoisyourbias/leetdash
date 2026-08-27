class Solution {
    public int strStr(String haystack, String needle) {
        if (!haystack.contains(needle)){
            return -1;
        } else {
            for(int i = 0; i < haystack.length() - needle.length()+1; i++) {
                if (haystack.substring(i, i+needle.length()).equals(needle)) {
                    return i;
                }
            }
            return 0;
        }
    }
}