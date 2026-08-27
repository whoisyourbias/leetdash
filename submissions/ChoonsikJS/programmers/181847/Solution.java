class Solution {
    public String solution(String n_str) {
        int pos = 0;
        for (int i = 0; i<n_str.length(); i++){
            if(i+1==n_str.length())break;
            if(n_str.charAt(i)!='0' && n_str.charAt(i+1) >'0') break;
            if(n_str.charAt(i)!=n_str.charAt(i+1)) {pos=i+1; break;}
        }
        return n_str.substring(pos);
    }
}