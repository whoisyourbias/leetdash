import java.util.*;

class Solution {
    static int[] newOne;

    public int[] plusOne(int[] digits) {
        newOne = digits;
        plusOne(digits, digits.length - 1);
        return newOne;
    }

    void plusOne(int[] digits, int idx) {
        if (idx == -1) {
            newOne = new int[digits.length + 1];

            for (int i = 0; i < digits.length; i++) {
                newOne[i + 1] = digits[i];
            }
            newOne[0] = 1;
            return;
        }

        if (digits[idx] == 9) {
            digits[idx] = 0;
            plusOne(digits, idx - 1);
        } else {
            digits[idx] += 1;
        }
    }
}
