class Solution {
    public boolean isPalindrome(String s) {
        int L = 0;
        int R = s.length() - 1;
        while (L < R) {
            //양 끝에서 시작해 문자가 아닌 것들을 건너뛰기
            while (L < R && !Character.isLetterOrDigit(s.charAt(L))) L++;
            while (L < R && !Character.isLetterOrDigit(s.charAt(R))) R--;
            //문자만 남았다면 비교 
            if (Character.toLowerCase(s.charAt(L)) != Character.toLowerCase(s.charAt(R))) return false;
            L++; R--;
        }
        return true;
    }
}