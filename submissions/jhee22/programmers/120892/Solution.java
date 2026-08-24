class Solution {
    public String solution(String cipher, int code) {
        StringBuilder sb = new StringBuilder();
        int num = 1; 
        // i = code - 1, i < cipher.length(); i += code; 하면 됫음 ㅎㅎ (곱하긴 결국 더하기니까...)
        while (cipher.length() >= num * code) {
            sb.append(cipher.charAt(num * code-1)); 
            num++; 
        }
        return sb.toString(); 
    }
}