class Solution {
    public boolean isPalindrome(String s) {
        // 뒤집은 문자가 앞 뒤로 똑같이 읽혀야함 : left(forward) right(backward) 투 포인터로 풀기 
        int left = 0; 
        int right = s.length() - 1; 
    
        // (1) Character.toLowerCase() : 소문자로 변경
        s = s.toLowerCase(); 

        // (2) 교차하기 전까지 
        while (left < right) {
            
            if (!Character.isLetterOrDigit(s.charAt(left))){
                left++; 
                continue;
            }

            if (!Character.isLetterOrDigit(s.charAt(right))){
                right--; 
                continue;
            }

            if (s.charAt(left) != s.charAt(right)){
                return false; 
            } 

            left++; 
            right--; 
 
        }
        return true;
        
    } // main
}
