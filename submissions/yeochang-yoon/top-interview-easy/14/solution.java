class Solution {
    public String longestCommonPrefix(String[] strs) {
        int n1 = strs.length;
        int n2 = 200;


        StringBuilder sb = new StringBuilder();

        for(int i = 0; i < n1; i++){
            n2 = Math.min(n2, strs[i].length());
        }

        int count = 0;

        for(int i = 0; i < n2; i++){
            char c = strs[0].charAt(i);
            for(int j = 0; j < n1; j++){
                if(strs[j].charAt(i) != c){
                    return sb.toString();
                }
            }
            sb.append(strs[0].charAt(i));
        }

        return sb.toString();
    }
}