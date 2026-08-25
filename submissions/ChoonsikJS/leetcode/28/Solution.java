class Solution {
    public int strStr(String haystack, String needle) {
        int H=haystack.length();
        int N=needle.length();

        if(H<N) return -1;
        if(H==N){
            if(haystack.equals(needle)) return 0;
            return -1;
        }
        if (N==1){
        for (int i = 0; i < H; i++) {
            if(haystack.charAt(i)==needle.charAt(0)) return i;}
        }
        for (int i = 0; i <= H-N; i++) {
            if(haystack.substring(i,i+N).equals(needle)) return i;
        }
        return -1;
    }
}
