class Solution {
    public int reverse(int x) {
        // 수학적 센스
        int result = 0;  
        int last = 0;
        while(x!=0){ // 123
            last = x % 10; // 3 -> 2
            x /= 10; // 123 -> 12 -> 1 

            
            // int 안넘게 범위 설정 (이걸 내가 어케 앎?)
            if (result > Integer.MAX_VALUE / 10 ||
                (result == Integer.MAX_VALUE / 10 && last > 7)){
                    return 0; 
                }
            
            if (result < Integer.MIN_VALUE / 10 ||
                (result == Integer.MIN_VALUE / 10 && last < -8)){
                    return 0;
                }
       

            result = result * 10 + last; // 3, 30+2, 
        }
       
         return result; 

        
    }
}