/* The isBadVersion API is defined in the parent class VersionControl.
      boolean isBadVersion(int version); */

public class Solution extends VersionControl {
    int g_version;

    public int firstBadVersion(int n) {
        g_version = Integer.MAX_VALUE;
        binarySearch(1, n);
        return this.g_version;
    }

    void binarySearch(int left, int right) {
        if (left > right) {return;}

        int middle = left + (right - left) / 2;
        boolean isBad = isBadVersion(middle);
        
        if (isBad && (middle < this.g_version)) {
            this.g_version = middle;
        }

        
        if (isBad) {
            binarySearch(left, middle - 1);
        }
        if (!isBad) {
            binarySearch(middle + 1, right);
        }
    }
}
