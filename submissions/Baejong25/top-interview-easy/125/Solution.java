class Solution {
    public boolean isPalindrome(String s) {
        int left = 0;
        int right = s.length()-1;
        char[] check = s.toCharArray();

        while(left < right) {
            while (left < right && !Character.isLetterOrDigit(check[right])) {
                right--;
            }
            while (left < right && !Character.isLetterOrDigit(check[left])) {
                left++;
            }

            if (Character.toLowerCase(check[left]) != Character.toLowerCase(check[right])) {
                return false;
            }
            left++;
            right--;
        }
        return true;
    }
}