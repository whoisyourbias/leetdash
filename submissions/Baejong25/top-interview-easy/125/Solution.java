class Solution {
    public boolean isPalindrome(String s) {
        int left = 0;
        int right = s.length()-1;
        char[] arr1 = s.toCharArray();

        while(left < right){
            while(left < right && !Character.isLetterOrDigit(arr1[left])){
                left++;
            }
            while(left < right && !Character.isLetterOrDigit(arr1[right])){
                right--;
            }
            if (Character.toLowerCase(arr1[left]) != Character.toLowerCase(arr1[right])){
                return false;
            }
            left++;
            right--;
        }
        return true;
    }
}