class Solution {
    public int strStr(String haystack, String needle) {
        int h = haystack.length();
        int n = needle.length();

        if(h < n) {
            return -1;
        }



        for(int i = 0; i < h - n + 1; i++){
            if(haystack.charAt(i) == needle.charAt(0)){
                boolean same = true;
                for(int j = 0; j < n; j++){
                    if(haystack.charAt(i + j) != needle.charAt(j)){
                        same = false;
                        break;
                    }
                }
                if(same){
                    return i;
                }
            }
        }

        return -1;
    }
}

